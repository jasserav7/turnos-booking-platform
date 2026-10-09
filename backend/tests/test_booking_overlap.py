import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Booking, BookingStatus, Service, User, UserRole

START = datetime(2030, 1, 7, 15, 0, tzinfo=UTC)


def _user(session: Session, role: UserRole) -> User:
    user = User(
        email=f"{uuid.uuid4()}@example.com",
        password_hash="x",
        full_name="Test",
        role=role,
    )
    session.add(user)
    session.flush()
    return user


def _service(session: Session) -> Service:
    service = Service(name="Corte", description="", duration_minutes=60, price_cents=1000)
    session.add(service)
    session.flush()
    return service


def _booking(
    customer: User,
    provider: User,
    service: Service,
    start: datetime = START,
    status: BookingStatus = BookingStatus.pending,
) -> Booking:
    return Booking(
        customer_id=customer.id,
        provider_id=provider.id,
        service_id=service.id,
        starts_at=start,
        ends_at=start + timedelta(minutes=60),
        status=status,
    )


def test_overlapping_bookings_rejected(session: Session) -> None:
    customer = _user(session, UserRole.customer)
    provider = _user(session, UserRole.provider)
    service = _service(session)
    session.add(_booking(customer, provider, service))
    session.flush()

    with pytest.raises(IntegrityError), session.begin_nested():
        session.add(_booking(customer, provider, service, START + timedelta(minutes=30)))
        session.flush()


def test_cancelled_booking_does_not_block(session: Session) -> None:
    customer = _user(session, UserRole.customer)
    provider = _user(session, UserRole.provider)
    service = _service(session)
    session.add(_booking(customer, provider, service, status=BookingStatus.cancelled))
    session.flush()

    session.add(_booking(customer, provider, service))
    session.flush()


def test_other_provider_does_not_block(session: Session) -> None:
    customer = _user(session, UserRole.customer)
    provider_a = _user(session, UserRole.provider)
    provider_b = _user(session, UserRole.provider)
    service = _service(session)
    session.add(_booking(customer, provider_a, service))
    session.flush()

    session.add(_booking(customer, provider_b, service))
    session.flush()
