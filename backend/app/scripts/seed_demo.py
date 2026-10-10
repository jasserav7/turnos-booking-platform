"""Idempotent demo data: users, services, weekly availability and sample bookings."""

from datetime import UTC, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import (
    AvailabilityRule,
    Booking,
    BookingStatus,
    ProviderService,
    Service,
    User,
    UserRole,
)

DEMO_PASSWORD = "Demo12345!"

# (email, full_name, role)
DEMO_USERS = [
    ("admin@demo.turnos.local", "Admin Demo", UserRole.admin),
    ("laura@demo.turnos.local", "Laura Gómez", UserRole.provider),
    ("andres@demo.turnos.local", "Andrés Rojas", UserRole.provider),
    ("cliente@demo.turnos.local", "Camila Cliente", UserRole.customer),
]

# (name, description, duration_minutes, price in COP)
DEMO_SERVICES = [
    ("Consulta general", "Primera valoración y plan de seguimiento.", 30, 60000),
    ("Consulta de control", "Revisión de avances y ajustes.", 30, 45000),
    ("Sesión de fisioterapia", "Terapia manual y ejercicios guiados.", 60, 90000),
    ("Masaje descontracturante", "Alivio de tensión muscular.", 45, 80000),
    ("Asesoría nutricional", "Plan de alimentación personalizado.", 60, 100000),
]

# provider email -> service names offered
PROVIDER_SERVICES = {
    "laura@demo.turnos.local": [
        "Consulta general",
        "Consulta de control",
        "Asesoría nutricional",
    ],
    "andres@demo.turnos.local": [
        "Consulta de control",
        "Sesión de fisioterapia",
        "Masaje descontracturante",
    ],
}

# provider email -> {weekday (0=Mon): [(start, end), ...]} in APP_TIMEZONE
PROVIDER_AVAILABILITY = {
    "laura@demo.turnos.local": {
        d: [(time(8, 0), time(12, 0)), (time(14, 0), time(17, 0))] for d in range(0, 5)
    },
    "andres@demo.turnos.local": {
        **{d: [(time(9, 0), time(13, 0))] for d in (0, 2, 4)},
        5: [(time(9, 0), time(12, 0))],
    },
}


def _get_or_create_users(db: Session) -> dict[str, User]:
    users: dict[str, User] = {}
    password_hash = hash_password(DEMO_PASSWORD)
    for email, full_name, role in DEMO_USERS:
        user = db.scalar(select(User).where(User.email == email))
        if user is None:
            user = User(
                email=email,
                password_hash=password_hash,
                full_name=full_name,
                role=role,
                is_active=True,
                email_verified_at=datetime.now(UTC),
            )
            db.add(user)
        users[email] = user
    db.flush()
    return users


def _get_or_create_services(db: Session) -> dict[str, Service]:
    services: dict[str, Service] = {}
    for name, description, duration, price in DEMO_SERVICES:
        service = db.scalar(select(Service).where(Service.name == name))
        if service is None:
            service = Service(
                name=name,
                description=description,
                duration_minutes=duration,
                price_cents=price * 100,
                is_active=True,
            )
            db.add(service)
        services[name] = service
    db.flush()
    return services


def _link_provider_services(
    db: Session, users: dict[str, User], services: dict[str, Service]
) -> None:
    for email, names in PROVIDER_SERVICES.items():
        for name in names:
            key = (users[email].id, services[name].id)
            if db.get(ProviderService, key) is None:
                db.add(ProviderService(provider_id=key[0], service_id=key[1]))
    db.flush()


def _set_availability(db: Session, users: dict[str, User]) -> None:
    for email, week in PROVIDER_AVAILABILITY.items():
        provider = users[email]
        # Only seed providers that have no rules yet so manual edits are preserved.
        if db.scalar(
            select(AvailabilityRule.id).where(AvailabilityRule.provider_id == provider.id)
        ):
            continue
        for weekday, ranges in week.items():
            for start, end in ranges:
                db.add(
                    AvailabilityRule(
                        provider_id=provider.id, weekday=weekday, start_time=start, end_time=end
                    )
                )
    db.flush()


def _next_weekday_at(base: datetime, weekday: int, at: time, tz: ZoneInfo, weeks: int) -> datetime:
    """First `weekday` strictly after `base` (+ `weeks` extra weeks) at `at` local time, in UTC."""
    local = base.astimezone(tz)
    days = (weekday - local.weekday()) % 7 or 7
    day = (local + timedelta(days=days + 7 * weeks)).date()
    return datetime.combine(day, at, tzinfo=tz).astimezone(UTC)


def _seed_bookings(db: Session, users: dict[str, User], services: dict[str, Service]) -> None:
    customer = users["cliente@demo.turnos.local"]
    # Bookings are only seeded once: if the demo customer has any, leave them alone.
    if db.scalar(select(Booking.id).where(Booking.customer_id == customer.id)):
        return

    tz = ZoneInfo(get_settings().app_timezone)
    now = datetime.now(UTC)
    laura = users["laura@demo.turnos.local"]
    andres = users["andres@demo.turnos.local"]

    # (provider, service, start, status, cancelled_by_customer)
    plan: list[tuple[User, str, datetime, BookingStatus, bool]] = [
        (
            laura,
            "Consulta general",
            _next_weekday_at(now, 0, time(8, 0), tz, 0),
            BookingStatus.pending,
            False,
        ),
        (
            laura,
            "Asesoría nutricional",
            _next_weekday_at(now, 1, time(9, 0), tz, 0),
            BookingStatus.confirmed,
            False,
        ),
        (
            andres,
            "Sesión de fisioterapia",
            _next_weekday_at(now, 2, time(10, 0), tz, 0),
            BookingStatus.confirmed,
            False,
        ),
        (
            andres,
            "Masaje descontracturante",
            _next_weekday_at(now, 4, time(9, 0), tz, 1),
            BookingStatus.cancelled,
            True,
        ),
        (laura, "Consulta de control", now - timedelta(days=7), BookingStatus.completed, False),
    ]
    for provider, service_name, start, status, by_customer in plan:
        service = services[service_name]
        if status is BookingStatus.completed:
            start = start.astimezone(tz).replace(minute=0, second=0, microsecond=0).astimezone(UTC)
        db.add(
            Booking(
                customer_id=customer.id,
                provider_id=provider.id,
                service_id=service.id,
                starts_at=start,
                ends_at=start + timedelta(minutes=service.duration_minutes),
                status=status,
                notes="Reserva de ejemplo (datos demo).",
                cancelled_by=customer.id if by_customer else None,
                cancel_reason="Cambio de planes" if by_customer else None,
            )
        )
    db.flush()


def main() -> None:
    with SessionLocal() as db:
        users = _get_or_create_users(db)
        services = _get_or_create_services(db)
        _link_provider_services(db, users, services)
        _set_availability(db, users)
        _seed_bookings(db, users, services)
        db.commit()
    print(f"Demo data ready (password for demo users: {DEMO_PASSWORD})")


if __name__ == "__main__":
    main()
