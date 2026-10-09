import uuid
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status
from sqlalchemy import Select, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core import notifications
from app.core.config import get_settings
from app.models import Booking, BookingStatus, User, UserRole
from app.schemas.booking import BookingIn
from app.services import catalog
from app.services.permissions import ensure_roles

EXCLUSION_VIOLATION = "23P01"


def _conflict(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)


def _visible_to(query: Select[tuple[Booking]], actor: User) -> Select[tuple[Booking]]:
    if actor.role == UserRole.customer:
        return query.where(Booking.customer_id == actor.id)
    if actor.role == UserRole.provider:
        return query.where(Booking.provider_id == actor.id)
    return query


def _local_midnight_utc(day: date) -> datetime:
    tz = ZoneInfo(get_settings().app_timezone)
    return datetime.combine(day, time.min, tzinfo=tz).astimezone(UTC)


def _is_exclusion_violation(exc: IntegrityError) -> bool:
    return getattr(exc.orig, "sqlstate", None) == EXCLUSION_VIOLATION


def create_booking(db: Session, actor: User, data: BookingIn) -> Booking:
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
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        if _is_exclusion_violation(exc):
            raise _conflict("slot_unavailable") from exc
        raise
    db.refresh(booking)
    notifications.notify_booking_created(booking)
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
    items = db.scalars(query.order_by(Booking.starts_at, Booking.id).limit(limit).offset(offset))
    return list(items), total


def get_booking(db: Session, actor: User, booking_id: uuid.UUID) -> Booking:
    booking = db.scalar(_visible_to(select(Booking).where(Booking.id == booking_id), actor))
    if booking is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="booking_not_found")
    return booking


def _save(db: Session, booking: Booking) -> Booking:
    db.commit()
    db.refresh(booking)
    return booking


def confirm_booking(db: Session, actor: User, booking_id: uuid.UUID) -> Booking:
    booking = get_booking(db, actor, booking_id)
    ensure_roles(actor, UserRole.provider, UserRole.admin)
    if booking.status != BookingStatus.pending:
        raise _conflict("invalid_transition")
    booking.status = BookingStatus.confirmed
    _save(db, booking)
    notifications.notify_booking_confirmed(booking)
    return booking


def cancel_booking(db: Session, actor: User, booking_id: uuid.UUID, reason: str | None) -> Booking:
    booking = get_booking(db, actor, booking_id)
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
    notifications.notify_booking_cancelled(booking)
    return booking


def complete_booking(db: Session, actor: User, booking_id: uuid.UUID) -> Booking:
    booking = get_booking(db, actor, booking_id)
    ensure_roles(actor, UserRole.provider, UserRole.admin)
    if booking.status != BookingStatus.confirmed or booking.starts_at > datetime.now(UTC):
        raise _conflict("invalid_transition")
    booking.status = BookingStatus.completed
    return _save(db, booking)
