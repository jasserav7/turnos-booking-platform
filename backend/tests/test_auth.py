from collections.abc import Callable
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from httpx import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import notifications
from app.core.security import create_access_token, create_reset_token, create_verify_token
from app.models import User, UserRole
from tests.conftest import DEFAULT_PASSWORD

API = "/api/v1"


def _login(client: TestClient, email: str, password: str = DEFAULT_PASSWORD) -> Response:
    return client.post(f"{API}/auth/login", json={"email": email, "password": password})


def _refresh(client: TestClient, raw: str) -> Response:
    client.cookies.clear()
    return client.post(f"{API}/auth/refresh", headers={"Cookie": f"refresh_token={raw}"})


def _me(client: TestClient, token: str) -> Response:
    return client.get(f"{API}/users/me", headers={"Authorization": f"Bearer {token}"})


@pytest.fixture
def captured(monkeypatch: pytest.MonkeyPatch) -> dict[str, list[str]]:
    sent: dict[str, list[str]] = {"verify": [], "reset": []}
    monkeypatch.setattr(
        notifications, "notify_verify_email", lambda user, token: sent["verify"].append(token)
    )
    monkeypatch.setattr(
        notifications, "notify_password_reset", lambda user, token: sent["reset"].append(token)
    )
    return sent


# --- register -----------------------------------------------------------------


def test_register_normalizes_email_and_creates_customer(
    client: TestClient, captured: dict[str, list[str]]
) -> None:
    response = client.post(
        f"{API}/auth/register",
        json={
            "email": "Ana.Perez@Example.com",
            "password": DEFAULT_PASSWORD,
            "full_name": "Ana Pérez",
            "role": "admin",
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "ana.perez@example.com"
    assert body["role"] == "customer"
    assert body["email_verified_at"] is None
    assert "password_hash" not in body
    assert len(captured["verify"]) == 1


def test_register_duplicate_returns_409(
    client: TestClient, captured: dict[str, list[str]]
) -> None:
    payload = {"email": "dup@example.com", "password": DEFAULT_PASSWORD, "full_name": "Dup"}
    assert client.post(f"{API}/auth/register", json=payload).status_code == 201
    payload["email"] = "DUP@example.com"
    response = client.post(f"{API}/auth/register", json=payload)
    assert response.status_code == 409
    assert response.json() == {"detail": "email_taken"}


# --- login --------------------------------------------------------------------


def test_login_returns_access_token_and_refresh_cookie(
    client: TestClient, make_user: Callable[..., User]
) -> None:
    user = make_user()
    response = _login(client, user.email.upper())
    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["user"]["id"] == str(user.id)
    assert "password_hash" not in body["user"]

    set_cookie = response.headers["set-cookie"]
    assert "refresh_token=" in set_cookie
    assert "HttpOnly" in set_cookie
    assert "Path=/api/v1/auth" in set_cookie
    assert "samesite=lax" in set_cookie.lower()

    assert _me(client, body["access_token"]).status_code == 200


def test_login_error_is_generic(client: TestClient, make_user: Callable[..., User]) -> None:
    user = make_user()
    wrong_password = _login(client, user.email, "WrongPass123!")
    unknown_email = _login(client, "nobody@example.com")
    assert wrong_password.status_code == unknown_email.status_code == 401
    assert wrong_password.json() == unknown_email.json() == {"detail": "invalid_credentials"}


def test_inactive_user_cannot_login(client: TestClient, make_user: Callable[..., User]) -> None:
    user = make_user(is_active=False)
    response = _login(client, user.email)
    assert response.status_code == 401
    assert response.json() == {"detail": "invalid_credentials"}


def test_deactivated_user_access_token_rejected(
    client: TestClient, session: Session, make_user: Callable[..., User]
) -> None:
    user = make_user()
    token = create_access_token(user.id, user.role)
    user.is_active = False
    session.flush()
    assert _me(client, token).status_code == 401


def test_login_is_rate_limited(client: TestClient) -> None:
    for _ in range(5):
        assert _login(client, "nobody@example.com").status_code == 401
    response = _login(client, "nobody@example.com")
    assert response.status_code == 429
    assert response.json() == {"detail": "rate_limited"}


# --- refresh / logout ---------------------------------------------------------


def test_refresh_rotates_and_old_token_fails(
    client: TestClient, make_user: Callable[..., User]
) -> None:
    user = make_user()
    old = _login(client, user.email).cookies["refresh_token"]

    rotated = _refresh(client, old)
    assert rotated.status_code == 200
    new = rotated.cookies["refresh_token"]
    assert new != old
    assert _me(client, rotated.json()["access_token"]).status_code == 200

    assert _refresh(client, old).status_code == 401


def test_reusing_revoked_refresh_token_revokes_family(
    client: TestClient, make_user: Callable[..., User]
) -> None:
    user = make_user()
    first = _login(client, user.email).cookies["refresh_token"]
    second = _refresh(client, first).cookies["refresh_token"]

    # Reuse of the already rotated token must kill the whole family.
    assert _refresh(client, first).status_code == 401
    assert _refresh(client, second).status_code == 401


def test_other_sessions_survive_family_revocation(
    client: TestClient, make_user: Callable[..., User]
) -> None:
    user = make_user()
    session_a = _login(client, user.email).cookies["refresh_token"]
    session_b = _login(client, user.email).cookies["refresh_token"]
    _refresh(client, session_a)
    assert _refresh(client, session_a).status_code == 401
    assert _refresh(client, session_b).status_code == 200


def test_refresh_without_cookie_is_401(client: TestClient) -> None:
    assert client.post(f"{API}/auth/refresh").status_code == 401


def test_logout_revokes_refresh_token(
    client: TestClient, make_user: Callable[..., User]
) -> None:
    user = make_user()
    raw = _login(client, user.email).cookies["refresh_token"]
    client.cookies.clear()
    response = client.post(f"{API}/auth/logout", headers={"Cookie": f"refresh_token={raw}"})
    assert response.status_code == 204
    assert _refresh(client, raw).status_code == 401


# --- token types --------------------------------------------------------------


@pytest.mark.parametrize("kind", ["refresh", "verify", "reset"])
def test_non_access_tokens_rejected_as_bearer(
    client: TestClient, make_user: Callable[..., User], kind: str
) -> None:
    user = make_user()
    tokens = {
        "refresh": lambda: _login(client, user.email).cookies["refresh_token"],
        "verify": lambda: create_verify_token(user.id),
        "reset": lambda: create_reset_token(user.id, user.password_hash),
    }
    response = _me(client, tokens[kind]())
    assert response.status_code == 401


def test_access_token_cannot_verify_or_reset(
    client: TestClient, make_user: Callable[..., User]
) -> None:
    user = make_user()
    access = create_access_token(user.id, user.role)
    assert client.get(f"{API}/auth/verify-email", params={"token": access}).status_code == 400
    response = client.post(
        f"{API}/auth/reset-password", json={"token": access, "new_password": "NuevaClave123!"}
    )
    assert response.status_code == 400
    verify = create_verify_token(user.id)
    response = client.post(
        f"{API}/auth/reset-password", json={"token": verify, "new_password": "NuevaClave123!"}
    )
    assert response.status_code == 400


# --- email verification -------------------------------------------------------


def test_verify_email(
    client: TestClient, session: Session, captured: dict[str, list[str]]
) -> None:
    client.post(
        f"{API}/auth/register",
        json={"email": "verify@example.com", "password": DEFAULT_PASSWORD, "full_name": "V"},
    )
    token = captured["verify"][0]
    response = client.get(f"{API}/auth/verify-email", params={"token": token})
    assert response.status_code == 200
    user = session.scalar(select(User).where(User.email == "verify@example.com"))
    assert user is not None
    assert user.email_verified_at is not None


def test_verify_email_rejects_garbage(client: TestClient) -> None:
    response = client.get(f"{API}/auth/verify-email", params={"token": "not-a-token"})
    assert response.status_code == 400
    assert response.json() == {"detail": "invalid_token"}


# --- password reset -----------------------------------------------------------


def test_forgot_password_same_response_for_any_email(
    client: TestClient, make_user: Callable[..., User], captured: dict[str, list[str]]
) -> None:
    user = make_user()
    existing = client.post(f"{API}/auth/forgot-password", json={"email": user.email})
    missing = client.post(f"{API}/auth/forgot-password", json={"email": "ghost@example.com"})
    assert existing.status_code == missing.status_code == 202
    assert existing.json() == missing.json()
    assert len(captured["reset"]) == 1


def test_reset_password_flow_and_single_use(
    client: TestClient, make_user: Callable[..., User], captured: dict[str, list[str]]
) -> None:
    user = make_user(role=UserRole.provider)
    refresh_before = _login(client, user.email).cookies["refresh_token"]
    client.post(f"{API}/auth/forgot-password", json={"email": user.email})
    token = captured["reset"][0]

    new_password = "NuevaClave123!"
    response = client.post(
        f"{API}/auth/reset-password", json={"token": token, "new_password": new_password}
    )
    assert response.status_code == 204

    assert _login(client, user.email, new_password).status_code == 200
    assert _login(client, user.email).status_code == 401
    assert _refresh(client, refresh_before).status_code == 401

    reused = client.post(
        f"{API}/auth/reset-password", json={"token": token, "new_password": "OtraClave123!"}
    )
    assert reused.status_code == 400


def test_reset_password_expired_token(
    client: TestClient, make_user: Callable[..., User]
) -> None:
    user = make_user()
    token = create_reset_token(user.id, user.password_hash, ttl=timedelta(seconds=-1))
    response = client.post(
        f"{API}/auth/reset-password", json={"token": token, "new_password": "NuevaClave123!"}
    )
    assert response.status_code == 400
    assert response.json() == {"detail": "invalid_token"}
