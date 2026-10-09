"""Transactional emails. Callers enqueue these with BackgroundTasks after committing."""

import uuid
from dataclasses import dataclass
from datetime import datetime
from zoneinfo import ZoneInfo

from app.core.config import get_settings
from app.core.email import send_email
from app.models import User

WEEKDAYS = ("lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo")
MONTHS = (
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
)


@dataclass(frozen=True)
class Recipient:
    email: str
    name: str


@dataclass(frozen=True)
class BookingEmailData:
    """Plain snapshot of a booking so emails never touch the database session."""

    booking_id: uuid.UUID
    customer: Recipient
    provider: Recipient
    service_name: str
    starts_at: datetime
    ends_at: datetime
    notes: str | None = None
    cancel_reason: str | None = None
    cancelled_by_name: str | None = None


def format_datetime(value: datetime) -> str:
    settings = get_settings()
    local = value.astimezone(ZoneInfo(settings.app_timezone))
    return (
        f"{WEEKDAYS[local.weekday()]} {local.day} de {MONTHS[local.month - 1]} "
        f"de {local.year}, {local:%H:%M} ({settings.app_timezone})"
    )


def _booking_context(data: BookingEmailData) -> dict[str, object]:
    return {
        "booking": data,
        "when": format_datetime(data.starts_at),
        "bookings_url": f"{get_settings().frontend_url}/bookings",
    }


def notify_verify_email(user: User, token: str) -> None:
    send_email(
        user.email,
        "Confirma tu correo en Turnos",
        "verify_email",
        name=user.full_name,
        link=f"{get_settings().frontend_url}/verify-email?token={token}",
    )


def notify_password_reset(user: User, token: str) -> None:
    send_email(
        user.email,
        "Restablece tu contraseña de Turnos",
        "password_reset",
        name=user.full_name,
        link=f"{get_settings().frontend_url}/reset-password?token={token}",
    )


def notify_booking_created(data: BookingEmailData) -> None:
    context = _booking_context(data)
    send_email(
        data.customer.email,
        f"Recibimos tu reserva: {data.service_name}",
        "booking_created_customer",
        **context,
    )
    send_email(
        data.provider.email,
        f"Nueva reserva pendiente: {data.service_name}",
        "booking_created_provider",
        **context,
    )


def notify_booking_confirmed(data: BookingEmailData) -> None:
    send_email(
        data.customer.email,
        f"Tu reserva está confirmada: {data.service_name}",
        "booking_confirmed",
        **_booking_context(data),
    )


def notify_booking_cancelled(data: BookingEmailData) -> None:
    context = _booking_context(data)
    subject = f"Reserva cancelada: {data.service_name}"
    for recipient in (data.customer, data.provider):
        send_email(recipient.email, subject, "booking_cancelled", recipient=recipient, **context)


def notify_booking_reminder(data: BookingEmailData) -> None:
    send_email(
        data.customer.email,
        f"Recordatorio: tu cita de {data.service_name} es pronto",
        "booking_reminder",
        **_booking_context(data),
    )
