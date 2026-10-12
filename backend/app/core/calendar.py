"""iCalendar (.ics) export for bookings, per RFC 5545, without third-party dependencies."""

from datetime import UTC, datetime
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.core.notifications import BookingEmailData

CRLF = "\r\n"
MAX_LINE_OCTETS = 75

ICS_STATUS = {
    "pending": "TENTATIVE",
    "confirmed": "CONFIRMED",
    "completed": "CONFIRMED",
    "cancelled": "CANCELLED",
}


def _escape(value: str) -> str:
    return (
        value.replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\r\n", "\\n")
        .replace("\n", "\\n")
        .replace("\r", "\\n")
    )


def _fold(line: str) -> str:
    """Fold at 75 octets, never inside a UTF-8 character; continuations start with a space."""
    data = line.encode("utf-8")
    if len(data) <= MAX_LINE_OCTETS:
        return line
    parts: list[str] = []
    current = b""
    limit = MAX_LINE_OCTETS
    for char in line:
        encoded = char.encode("utf-8")
        if len(current) + len(encoded) > limit:
            parts.append(current.decode("utf-8"))
            current = b""
            limit = MAX_LINE_OCTETS - 1
        current += encoded
    parts.append(current.decode("utf-8"))
    return (CRLF + " ").join(parts)


def _utc(value: datetime) -> str:
    return value.astimezone(UTC).strftime("%Y%m%dT%H%M%SZ")


def build_ics(
    data: "BookingEmailData",
    status: str,
    sequence: int = 0,
    now: datetime | None = None,
) -> bytes:
    """One VEVENT per booking; a stable UID lets a reschedule update the existing entry."""
    summary = f"{data.service_name} con {data.provider.name}"
    description = (
        f"Reserva en Turnos.\nProfesional: {data.provider.name}\nCliente: {data.customer.name}"
    )
    if data.notes:
        description += f"\nNotas: {data.notes}"
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Turnos//Reservas//ES",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        f"UID:{data.booking_id}@turnos",
        f"DTSTAMP:{_utc(now or datetime.now(UTC))}",
        f"DTSTART:{_utc(data.starts_at)}",
        f"DTEND:{_utc(data.ends_at)}",
        f"SEQUENCE:{sequence}",
        f"SUMMARY:{_escape(summary)}",
        f"DESCRIPTION:{_escape(description)}",
        f"STATUS:{ICS_STATUS[status]}",
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        "DESCRIPTION:Recordatorio de tu cita",
        "TRIGGER:-PT1H",
        "END:VALARM",
        "END:VEVENT",
        "END:VCALENDAR",
    ]
    return (CRLF.join(_fold(line) for line in lines) + CRLF).encode("utf-8")
