from datetime import UTC, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import (
    AvailabilityRule,
    Booking,
    BookingStatus,
    ProviderService,
    Service,
    User,
)


def make_service(session: Session, duration: int = 60, price_cents: int = 5000) -> Service:
    service = Service(
        name="Corte", description="", duration_minutes=duration, price_cents=price_cents
    )
    session.add(service)
    session.flush()
    return service


def offer(session: Session, provider: User, service: Service) -> None:
    """Make the provider offer the service, available every day 08:00-18:00 local."""
    session.add(ProviderService(provider_id=provider.id, service_id=service.id))
    session.add_all(
        AvailabilityRule(provider_id=provider.id, weekday=d, start_time=time(8), end_time=time(18))
        for d in range(7)
    )
    session.flush()


def tomorrow_at(hour: int, minute: int = 0) -> datetime:
    tz = ZoneInfo(get_settings().app_timezone)
    day = datetime.now(tz).date() + timedelta(days=1)
    return datetime.combine(day, time(hour, minute), tzinfo=tz).astimezone(UTC)


def insert_booking(
    session: Session,
    customer: User,
    provider: User,
    service: Service,
    starts_at: datetime,
    status: BookingStatus = BookingStatus.pending,
) -> Booking:
    booking = Booking(
        customer_id=customer.id,
        provider_id=provider.id,
        service_id=service.id,
        starts_at=starts_at,
        ends_at=starts_at + timedelta(minutes=service.duration_minutes),
        status=status,
    )
    session.add(booking)
    session.flush()
    return booking
