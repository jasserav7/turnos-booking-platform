import uuid
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import (
    AvailabilityRule,
    Booking,
    BookingStatus,
    ProviderService,
    Service,
    TimeOff,
    User,
    UserRole,
)
from app.schemas.catalog import ServiceIn, ServiceUpdateIn
from app.services.permissions import ensure_roles
from app.services.slots import MAX_RANGE_DAYS, SlotConfig, WeeklyRule, generate_slots

ACTIVE_STATUSES = (BookingStatus.pending, BookingStatus.confirmed)


def _not_found(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


def list_services(db: Session) -> list[Service]:
    query = select(Service).where(Service.is_active.is_(True)).order_by(Service.name, Service.id)
    return list(db.scalars(query))


def create_service(db: Session, actor: User, data: ServiceIn) -> Service:
    ensure_roles(actor, UserRole.admin)
    service = Service(**data.model_dump())
    db.add(service)
    db.commit()
    db.refresh(service)
    return service


def _get_service(db: Session, service_id: uuid.UUID) -> Service:
    service = db.get(Service, service_id)
    if service is None:
        raise _not_found("service_not_found")
    return service


def update_service(
    db: Session, actor: User, service_id: uuid.UUID, data: ServiceUpdateIn
) -> Service:
    ensure_roles(actor, UserRole.admin)
    service = _get_service(db, service_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(service, field, value)
    db.commit()
    db.refresh(service)
    return service


def deactivate_service(db: Session, actor: User, service_id: uuid.UUID) -> None:
    ensure_roles(actor, UserRole.admin)
    service = _get_service(db, service_id)
    service.is_active = False
    db.commit()


def set_provider_services(
    db: Session, actor: User, provider_id: uuid.UUID, service_ids: list[uuid.UUID]
) -> list[Service]:
    ensure_roles(actor, UserRole.admin)
    provider = db.get(User, provider_id)
    if provider is None or provider.role != UserRole.provider:
        raise _not_found("provider_not_found")
    unique_ids = set(service_ids)
    services = list(db.scalars(select(Service).where(Service.id.in_(unique_ids))))
    if len(services) != len(unique_ids):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="invalid_service"
        )
    db.execute(delete(ProviderService).where(ProviderService.provider_id == provider_id))
    db.add_all(ProviderService(provider_id=provider_id, service_id=s.id) for s in services)
    db.commit()
    return sorted(services, key=lambda s: (s.name, str(s.id)))


def list_providers(db: Session, service_id: uuid.UUID | None) -> list[User]:
    query = select(User).where(User.role == UserRole.provider, User.is_active.is_(True))
    if service_id is not None:
        query = query.join(ProviderService, ProviderService.provider_id == User.id).where(
            ProviderService.service_id == service_id
        )
    return list(db.scalars(query.order_by(User.full_name, User.id)))


def get_bookable(db: Session, provider_id: uuid.UUID, service_id: uuid.UUID) -> Service:
    """Return the service if it is active and offered by an active provider."""
    service = db.get(Service, service_id)
    if service is None or not service.is_active:
        raise _not_found("service_not_found")
    offered = db.scalar(
        select(User.id)
        .join(ProviderService, ProviderService.provider_id == User.id)
        .where(
            User.id == provider_id,
            User.role == UserRole.provider,
            User.is_active.is_(True),
            ProviderService.service_id == service_id,
        )
    )
    if offered is None:
        raise _not_found("provider_not_found")
    return service


def compute_slots(
    db: Session,
    provider_id: uuid.UUID,
    service: Service,
    date_from: date,
    date_to: date,
    now: datetime | None = None,
) -> list[datetime]:
    settings = get_settings()
    tz = ZoneInfo(settings.app_timezone)
    window_start = datetime.combine(date_from, time.min, tzinfo=tz).astimezone(UTC)
    window_end = datetime.combine(date_to + timedelta(days=1), time.min, tzinfo=tz).astimezone(UTC)
    rules = db.scalars(select(AvailabilityRule).where(AvailabilityRule.provider_id == provider_id))
    time_off = db.execute(
        select(TimeOff.starts_at, TimeOff.ends_at).where(
            TimeOff.provider_id == provider_id,
            TimeOff.starts_at < window_end,
            TimeOff.ends_at > window_start,
        )
    )
    bookings = db.execute(
        select(Booking.starts_at, Booking.ends_at).where(
            Booking.provider_id == provider_id,
            Booking.status.in_(ACTIVE_STATUSES),
            Booking.starts_at < window_end,
            Booking.ends_at > window_start,
        )
    )
    return generate_slots(
        rules=[WeeklyRule(r.weekday, r.start_time, r.end_time) for r in rules],
        time_off=[(start, end) for start, end in time_off],
        bookings=[(start, end) for start, end in bookings],
        duration_minutes=service.duration_minutes,
        date_from=date_from,
        date_to=date_to,
        now=now or datetime.now(UTC),
        tz=tz,
        config=SlotConfig(settings.min_notice_minutes, settings.booking_horizon_days),
    )


def provider_slots(
    db: Session,
    provider_id: uuid.UUID,
    service_id: uuid.UUID,
    date_from: date,
    date_to: date,
) -> list[datetime]:
    if date_to < date_from:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="invalid_range"
        )
    if (date_to - date_from).days + 1 > MAX_RANGE_DAYS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="range_too_large"
        )
    service = get_bookable(db, provider_id, service_id)
    return compute_slots(db, provider_id, service, date_from, date_to)
