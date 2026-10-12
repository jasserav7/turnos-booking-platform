from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.calendar import _fold
from app.models import BookingStatus, User, UserRole
from tests.conftest import FakeEmailSender, auth_headers
from tests.factories import insert_booking, make_service, offer, tomorrow_at

API = "/api/v1"


@pytest.fixture
def world(session: Session, make_user: Callable[..., User]) -> dict[str, Any]:
    provider = make_user(role=UserRole.provider)
    service = make_service(session)
    offer(session, provider, service)
    return {
        "provider": provider,
        "service": service,
        "customer": make_user(),
        "other": make_user(),
        "admin": make_user(role=UserRole.admin),
    }


def _reschedule(client: TestClient, booking_id: Any, actor: User, starts_at: datetime) -> Any:
    return client.post(
        f"{API}/bookings/{booking_id}/reschedule",
        json={"starts_at": starts_at.isoformat()},
        headers=auth_headers(actor),
    )


def _booking(
    session: Session,
    world: dict[str, Any],
    hour: int,
    status: BookingStatus = BookingStatus.pending,
) -> Any:
    return insert_booking(
        session, world["customer"], world["provider"], world["service"], tomorrow_at(hour), status
    )


def test_customer_reschedules_pending_booking(
    client: TestClient, session: Session, world: dict[str, Any], outbox: FakeEmailSender
) -> None:
    booking = _booking(session, world, 10)
    response = _reschedule(client, booking.id, world["customer"], tomorrow_at(14))
    assert response.status_code == 200, response.text
    body = response.json()
    assert datetime.fromisoformat(body["starts_at"]) == tomorrow_at(14)
    assert datetime.fromisoformat(body["ends_at"]) == tomorrow_at(15)
    assert body["status"] == "pending"
    subjects = {m.to: m for m in outbox.messages}
    assert world["customer"].email in subjects and world["provider"].email in subjects
    message = subjects[world["customer"].email]
    assert message.subject.startswith("Reserva reprogramada")
    assert message.attachments[0].filename == "reserva.ics"


def test_customer_move_of_confirmed_booking_needs_reconfirmation(
    client: TestClient, session: Session, world: dict[str, Any]
) -> None:
    booking = _booking(session, world, 10, BookingStatus.confirmed)
    customer_move = _reschedule(client, booking.id, world["customer"], tomorrow_at(14))
    assert customer_move.json()["status"] == "pending"

    confirmed = _booking(session, world, 8, BookingStatus.confirmed)
    provider_move = _reschedule(client, confirmed.id, world["provider"], tomorrow_at(16))
    assert provider_move.status_code == 200
    assert provider_move.json()["status"] == "confirmed"


def test_can_shift_overlapping_own_slot(
    client: TestClient, session: Session, world: dict[str, Any]
) -> None:
    """Moving 'later' by less than the duration overlaps the booking's own current slot."""
    service = world["service"]
    service.duration_minutes = 30
    session.flush()
    booking = _booking(session, world, 10)
    booking.ends_at = booking.starts_at + timedelta(minutes=30)
    session.flush()
    response = _reschedule(client, booking.id, world["customer"], tomorrow_at(10, 30))
    assert response.status_code == 200, response.text


def test_reschedule_conflicts(client: TestClient, session: Session, world: dict[str, Any]) -> None:
    booking = _booking(session, world, 10)
    insert_booking(session, world["other"], world["provider"], world["service"], tomorrow_at(12))
    taken = _reschedule(client, booking.id, world["customer"], tomorrow_at(12))
    assert taken.status_code == 409
    assert taken.json() == {"detail": "slot_unavailable"}
    outside = _reschedule(client, booking.id, world["customer"], tomorrow_at(22))
    assert outside.json() == {"detail": "slot_unavailable"}
    same = _reschedule(client, booking.id, world["customer"], tomorrow_at(10))
    assert same.json() == {"detail": "same_slot"}
    # The failed attempts left the booking untouched.
    current = client.get(f"{API}/bookings/{booking.id}", headers=auth_headers(world["customer"]))
    assert datetime.fromisoformat(current.json()["starts_at"]) == tomorrow_at(10)
    assert current.json()["status"] == "pending"


def test_reschedule_rules(client: TestClient, session: Session, world: dict[str, Any]) -> None:
    cancelled = _booking(session, world, 9, BookingStatus.cancelled)
    response = _reschedule(client, cancelled.id, world["customer"], tomorrow_at(14))
    assert response.json() == {"detail": "invalid_transition"}

    soon = insert_booking(
        session,
        world["customer"],
        world["provider"],
        world["service"],
        datetime.now(UTC) + timedelta(hours=1),
    )
    closed = _reschedule(client, soon.id, world["customer"], tomorrow_at(14))
    assert closed.status_code == 409
    assert closed.json() == {"detail": "reschedule_window_closed"}
    # Staff are not bound by the customer notice window.
    assert _reschedule(client, soon.id, world["provider"], tomorrow_at(14)).status_code == 200


def test_reschedule_requires_ownership(
    client: TestClient, session: Session, world: dict[str, Any]
) -> None:
    booking = _booking(session, world, 10)
    stranger = _reschedule(client, booking.id, world["other"], tomorrow_at(14))
    assert stranger.status_code == 404
    unauthenticated = client.post(
        f"{API}/bookings/{booking.id}/reschedule", json={"starts_at": tomorrow_at(14).isoformat()}
    )
    assert unauthenticated.status_code == 401
    naive = client.post(
        f"{API}/bookings/{booking.id}/reschedule",
        json={"starts_at": tomorrow_at(14).replace(tzinfo=None).isoformat()},
        headers=auth_headers(world["customer"]),
    )
    assert naive.status_code == 422


def test_calendar_export(client: TestClient, session: Session, world: dict[str, Any]) -> None:
    booking = _booking(session, world, 10, BookingStatus.confirmed)
    response = client.get(
        f"{API}/bookings/{booking.id}/calendar.ics", headers=auth_headers(world["customer"])
    )
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/calendar")
    text = response.content.decode()
    assert text.startswith("BEGIN:VCALENDAR\r\n") and text.endswith("END:VCALENDAR\r\n")
    assert f"UID:{booking.id}@turnos" in text
    assert "STATUS:CONFIRMED" in text
    assert f"DTSTART:{tomorrow_at(10):%Y%m%dT%H%M%SZ}" in text
    assert f"DTEND:{tomorrow_at(11):%Y%m%dT%H%M%SZ}" in text
    for line in text.split("\r\n"):
        assert len(line.encode()) <= 75

    stranger = client.get(
        f"{API}/bookings/{booking.id}/calendar.ics", headers=auth_headers(world["other"])
    )
    assert stranger.status_code == 404
    assert client.get(f"{API}/bookings/{booking.id}/calendar.ics").status_code == 401


def test_confirmation_email_carries_calendar_file(
    client: TestClient, session: Session, world: dict[str, Any], outbox: FakeEmailSender
) -> None:
    booking = _booking(session, world, 10)
    client.post(f"{API}/bookings/{booking.id}/confirm", headers=auth_headers(world["provider"]))
    sent = outbox.to(world["customer"].email)
    assert sent and sent[0].attachments[0].subtype == "calendar"
    assert b"STATUS:CONFIRMED" in sent[0].attachments[0].content


def test_ics_folding_keeps_utf8_intact() -> None:
    line = "SUMMARY:" + "Masaje descontracturante ñandú " * 6
    folded = _fold(line)
    assert all(len(part.encode()) <= 75 for part in folded.split("\r\n"))
    assert folded.replace("\r\n ", "") == line
