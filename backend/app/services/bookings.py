import uuid
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from fastapi import BackgroundTasks, HTTPException, status
from sqlalchemy import Select, func, select
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session, joinedload

from app.core import notifications
from app.core.calendar import build_ics
from app.core.config import get_settings
from app.models import Booking, BookingStatus, Service, User, UserRole
from app.schemas.booking import BookingIn
from app.services import catalog
from app.services.permissions import ensure_roles

EXCLUSION_VIOLATION = "23P01"
DEADLOCK_DETECTED = "40P01"


def _conflict(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)


def _visible_to(query: Select[tuple[Booking]], actor: User) -> Select[tuple[Booking]]:
    if actor.role == UserRole.customer:
        return query.where(Booking.customer_id == actor.id)
    if actor.role == UserRole.provider:
        return query.where(Booking.provider_id == actor.id)
    return query


def _with_names(query: Select[tuple[Booking]]) -> Select[tuple[Booking]]:
    return query.options(
        joinedload(Booking.customer), joinedload(Booking.provider), joinedload(Booking.service)
    )


def _local_midnight_utc(day: date) -> datetime:
    tz = ZoneInfo(get_settings().app_timezone)
    return datetime.combine(day, time.min, tzinfo=tz).astimezone(UTC)


def _is_slot_conflict(exc: DBAPIError) -> bool:
    """Exclusion violation, or the deadlock Postgres raises when two overlapping inserts race."""
    return getattr(exc.orig, "sqlstate", None) in (EXCLUSION_VIOLATION, DEADLOCK_DETECTED)


def _commit_or_conflict(db: Session, detail: str) -> None:
    try:
        db.commit()
    except DBAPIError as exc:
        db.rollback()
        if _is_slot_conflict(exc):
            raise _conflict(detail) from exc
        raise


def _recipient(user: User) -> notifications.Recipient:
    return notifications.Recipient(email=user.email, name=user.full_name)


def booking_email_data(
    db: Session, booking: Booking, previous_starts_at: datetime | None = None
) -> notifications.BookingEmailData:
    customer = db.get(User, booking.customer_id)
    provider = db.get(User, booking.provider_id)
    service = db.get(Service, booking.service_id)
    cancelled_by = db.get(User, booking.cancelled_by) if booking.cancelled_by else None
    assert customer is not None and provider is not None and service is not None
    return notifications.BookingEmailData(
        booking_id=booking.id,
        customer=_recipient(customer),
        provider=_recipient(provider),
        service_name=service.name,
        starts_at=booking.starts_at,
        ends_at=booking.ends_at,
        notes=booking.notes,
        cancel_reason=booking.cancel_reason,
        cancelled_by_name=cancelled_by.full_name if cancelled_by else None,
        previous_starts_at=previous_starts_at,
        status=booking.status.value,
        sequence=int(booking.updated_at.timestamp()),
    )


def create_booking(db: Session, actor: User, data: BookingIn, tasks: BackgroundTasks) -> Booking:
    ensure_roles(actor, UserRole.customer)
    service = catalog.get_bookable(db, data.provider_id, data.service_id)
    starts_at = data.starts_at.astimezone(UTC)
    local_day = starts_at.astimezone(ZoneInfo(get_settings().app_timezone)).date()
    slots = catalog.compute_slots(db, data.provider_id, service, local_day, local_day)
    if starts_at not in slots:
        raise _conflict("slot_unavailable")

    booking = Booking(
        customer_id=actor.id,
        provider_id=data.provider_id,
        service_id=service.id,
        starts_at=starts_at,
        ends_at=starts_at + timedelta(minutes=service.duration_minutes),
        status=BookingStatus.pending,
        notes=data.notes,
    )
    db.add(booking)
    _commit_or_conflict(db, "slot_unavailable")
    db.refresh(booking)
    tasks.add_task(notifications.notify_booking_created, booking_email_data(db, booking))
    return booking


def list_bookings(
    db: Session,
    actor: User,
    status_filter: BookingStatus | None,
    date_from: date | None,
    date_to: date | None,
    limit: int,
    offset: int,
) -> tuple[list[Booking], int]:
    query = _visible_to(select(Booking), actor)
    if status_filter is not None:
        query = query.where(Booking.status == status_filter)
    if date_from is not None:
        query = query.where(Booking.starts_at >= _local_midnight_utc(date_from))
    if date_to is not None:
        query = query.where(Booking.starts_at < _local_midnight_utc(date_to + timedelta(days=1)))
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    ordered = query.order_by(Booking.starts_at, Booking.id).limit(limit).offset(offset)
    items = db.scalars(_with_names(ordered))
    return list(items), total


def get_booking(
    db: Session, actor: User, booking_id: uuid.UUID, *, for_update: bool = False
) -> Booking:
    query = _visible_to(select(Booking).where(Booking.id == booking_id), actor)
    if for_update:
        # Lock only the booking row (FOR UPDATE cannot apply to the outer-joined names).
        query = query.with_for_update(of=Booking)
    booking = db.scalar(_with_names(query))
    if booking is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="booking_not_found")
    return booking


def _save(db: Session, booking: Booking) -> Booking:
    _commit_or_conflict(db, "invalid_transition")
    db.refresh(booking)
    return booking


def confirm_booking(
    db: Session, actor: User, booking_id: uuid.UUID, tasks: BackgroundTasks
) -> Booking:
    booking = get_booking(db, actor, booking_id, for_update=True)
    ensure_roles(actor, UserRole.provider, UserRole.admin)
    if booking.status != BookingStatus.pending:
        raise _conflict("invalid_transition")
    booking.status = BookingStatus.confirmed
    _save(db, booking)
    tasks.add_task(notifications.notify_booking_confirmed, booking_email_data(db, booking))
    return booking


def cancel_booking(
    db: Session,
    actor: User,
    booking_id: uuid.UUID,
    reason: str | None,
    tasks: BackgroundTasks,
) -> Booking:
    booking = get_booking(db, actor, booking_id, for_update=True)
    if booking.status not in (BookingStatus.pending, BookingStatus.confirmed):
        raise _conflict("invalid_transition")
    if actor.role == UserRole.customer:
        deadline = booking.starts_at - timedelta(hours=get_settings().cancel_min_hours)
        if datetime.now(UTC) > deadline:
            raise _conflict("cancellation_window_closed")
    booking.status = BookingStatus.cancelled
    booking.cancelled_by = actor.id
    booking.cancel_reason = reason
    _save(db, booking)
    tasks.add_task(notifications.notify_booking_cancelled, booking_email_data(db, booking))
    return booking


def complete_booking(db: Session, actor: User, booking_id: uuid.UUID) -> Booking:
    booking = get_booking(db, actor, booking_id, for_update=True)
    ensure_roles(actor, UserRole.provider, UserRole.admin)
    if booking.status != BookingStatus.confirmed or booking.starts_at > datetime.now(UTC):
        raise _conflict("invalid_transition")
    booking.status = BookingStatus.completed
    return _save(db, booking)


def reschedule_booking(
    db: Session,
    actor: User,
    booking_id: uuid.UUID,
    new_starts_at: datetime,
    tasks: BackgroundTasks,
) -> Booking:
    booking = get_booking(db, actor, booking_id, for_update=True)
    if booking.status not in (BookingStatus.pending, BookingStatus.confirmed):
        raise _conflict("invalid_transition")
    if actor.role == UserRole.customer:
        deadline = booking.starts_at - timedelta(hours=get_settings().cancel_min_hours)
        if datetime.now(UTC) > deadline:
            raise _conflict("reschedule_window_closed")

    starts_at = new_starts_at.astimezone(UTC)
    if starts_at == booking.starts_at:
        raise _conflict("same_slot")
    service = catalog.get_bookable(db, booking.provider_id, booking.service_id)

    previous_starts_at, previous_status = booking.starts_at, booking.status
    # Free the current slot inside this transaction so the new time may overlap the old one
    # (e.g. moving 30 minutes later); the status is restored if the new slot is invalid.
    booking.status = BookingStatus.cancelled
    db.flush()
    local_day = starts_at.astimezone(ZoneInfo(get_settings().app_timezone)).date()
    if starts_at not in catalog.compute_slots(
        db, booking.provider_id, service, local_day, local_day
    ):
        booking.status = previous_status
        db.flush()
        raise _conflict("slot_unavailable")

    booking.starts_at = starts_at
    booking.ends_at = starts_at + timedelta(minutes=service.duration_minutes)
    # A customer move of a confirmed booking needs the professional to confirm again.
    needs_reconfirmation = (
        actor.role == UserRole.customer and previous_status == BookingStatus.confirmed
    )
    booking.status = BookingStatus.pending if needs_reconfirmation else previous_status
    booking.reminder_sent_at = None
    _commit_or_conflict(db, "slot_unavailable")
    db.refresh(booking)
    tasks.add_task(
        notifications.notify_booking_rescheduled,
        booking_email_data(db, booking, previous_starts_at),
    )
    return booking


def booking_calendar(db: Session, actor: User, booking_id: uuid.UUID) -> bytes:
    booking = get_booking(db, actor, booking_id)
    data = booking_email_data(db, booking)
    return build_ics(data, data.status, data.sequence)
