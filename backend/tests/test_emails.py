import logging
import re
import uuid
from collections.abc import Callable
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core import email as email_core
from app.core.config import get_settings
from app.jobs.send_reminders import send_reminders
from app.models import BookingStatus, User, UserRole
from tests.conftest import DEFAULT_PASSWORD, FakeEmailSender, SentEmail, auth_headers
from tests.factories import insert_booking, make_service, offer, tomorrow_at

API = "/api/v1"


def _assert_complete(message: SentEmail) -> None:
    assert message.subject
    assert message.text.strip()
    assert "<html" in message.html


def _link_token(message: SentEmail, path: str) -> str:
    base = re.escape(f"{get_settings().frontend_url}{path}?token=")
    match = re.search(base + r"(\S+)", message.text)
    assert match is not None
    assert match.group(0) in message.html
    return match.group(1)


def test_register_sends_verification_email(client: TestClient, outbox: FakeEmailSender) -> None:
    email = f"{uuid.uuid4().hex}@example.com"
    response = client.post(
        f"{API}/auth/register",
        json={"email": email, "password": DEFAULT_PASSWORD, "full_name": "Ana Pérez"},
    )
    assert response.status_code == 201

    [message] = outbox.to(email)
    _assert_complete(message)
    assert "Ana Pérez" in message.text
    token = _link_token(message, "/verify-email")
    verified = client.get(f"{API}/auth/verify-email", params={"token": token})
    assert verified.status_code == 200


def test_forgot_password_emails_only_existing_users(
    client: TestClient, outbox: FakeEmailSender, make_user: Callable[..., User]
) -> None:
    user = make_user()
    existing = client.post(f"{API}/auth/forgot-password", json={"email": user.email})
    missing = client.post(f"{API}/auth/forgot-password", json={"email": "nadie@example.com"})

    assert existing.status_code == missing.status_code == 202
    assert existing.json() == missing.json()
    assert outbox.to("nadie@example.com") == []
    [message] = outbox.to(user.email)
    _assert_complete(message)
    token = _link_token(message, "/reset-password")
    reset = client.post(
        f"{API}/auth/reset-password", json={"token": token, "new_password": "OtraClave123!"}
    )
    assert reset.status_code == 204


def test_booking_lifecycle_emails(
    client: TestClient,
    session: Session,
    outbox: FakeEmailSender,
    make_user: Callable[..., User],
) -> None:
    customer = make_user()
    provider = make_user(role=UserRole.provider)
    service = make_service(session)
    offer(session, provider, service)

    created = client.post(
        f"{API}/bookings",
        json={
            "provider_id": str(provider.id),
            "service_id": str(service.id),
            "starts_at": tomorrow_at(10).isoformat(),
            "notes": "Primera vez",
        },
        headers=auth_headers(customer),
    )
    assert created.status_code == 201
    assert len(outbox.to(customer.email)) == 1
    [provider_message] = outbox.to(provider.email)
    assert "Primera vez" in provider_message.text
    for message in outbox.messages:
        _assert_complete(message)
        assert service.name in message.text
    booking_url = f"{API}/bookings/{created.json()['id']}"

    outbox.messages.clear()
    assert client.post(f"{booking_url}/confirm", headers=auth_headers(provider)).status_code == 200
    assert [m.to for m in outbox.messages] == [customer.email]
    assert "confirmada" in outbox.messages[0].subject

    outbox.messages.clear()
    cancelled = client.post(
        f"{booking_url}/cancel", json={"reason": "Viaje"}, headers=auth_headers(customer)
    )
    assert cancelled.status_code == 200
    assert sorted(m.to for m in outbox.messages) == sorted([customer.email, provider.email])
    assert all("Viaje" in m.text for m in outbox.messages)


class _BrokenSender:
    def send(self, to: str, subject: str, html: str, text: str) -> None:
        raise ConnectionRefusedError("smtp down")


def test_sender_failure_does_not_break_api(
    client: TestClient,
    session: Session,
    make_user: Callable[..., User],
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    monkeypatch.setattr(email_core, "get_email_sender", lambda: _BrokenSender())
    customer = make_user()
    provider = make_user(role=UserRole.provider)
    service = make_service(session)
    offer(session, provider, service)

    with caplog.at_level(logging.ERROR, logger="app.email"):
        registered = client.post(
            f"{API}/auth/register",
            json={
                "email": f"{uuid.uuid4().hex}@example.com",
                "password": DEFAULT_PASSWORD,
                "full_name": "Sin Correo",
            },
        )
        booked = client.post(
            f"{API}/bookings",
            json={
                "provider_id": str(provider.id),
                "service_id": str(service.id),
                "starts_at": tomorrow_at(11).isoformat(),
            },
            headers=auth_headers(customer),
        )
    assert registered.status_code == 201
    assert booked.status_code == 201
    assert "Failed to send" in caplog.text


def test_unreachable_smtp_is_logged_not_raised(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    settings = get_settings().model_copy(update={"smtp_host": "127.0.0.1", "smtp_port": 1})
    monkeypatch.setattr(
        email_core, "get_email_sender", lambda: email_core.SmtpEmailSender(settings)
    )
    with caplog.at_level(logging.ERROR, logger="app.email"):
        email_core.send_email("x@example.com", "Asunto", "verify_email", name="X", link="http://x")
    assert "Failed to send" in caplog.text


def test_reminder_job_is_idempotent_and_respects_window(
    session: Session, outbox: FakeEmailSender, make_user: Callable[..., User]
) -> None:
    provider = make_user(role=UserRole.provider)
    service = make_service(session)
    now = datetime.now(UTC)

    def booking(hours: float, status: BookingStatus = BookingStatus.confirmed) -> User:
        customer = make_user()
        insert_booking(session, customer, provider, service, now + timedelta(hours=hours), status)
        return customer

    due_soon = booking(1)
    due_late = booking(23.5)
    too_far = booking(25)
    pending = booking(2, BookingStatus.pending)
    started = booking(-0.5)
    reminded = make_user()
    insert_booking(
        session, reminded, provider, service, now + timedelta(hours=5), BookingStatus.confirmed
    ).reminder_sent_at = now - timedelta(hours=1)
    session.flush()

    assert send_reminders(session, now) == 2
    assert sorted(m.to for m in outbox.messages) == sorted([due_soon.email, due_late.email])
    for message in outbox.messages:
        _assert_complete(message)
    for user in (too_far, pending, started, reminded):
        assert outbox.to(user.email) == []

    assert send_reminders(session, now) == 0
    assert send_reminders(session, now + timedelta(minutes=5)) == 0
    assert len(outbox.messages) == 2
