import uuid
from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient

from app.models import User, UserRole
from tests.conftest import auth_headers

API = "/api/v1"


def test_admin_users_requires_token(client: TestClient) -> None:
    response = client.get(f"{API}/admin/users")
    assert response.status_code == 401


@pytest.mark.parametrize("role", [UserRole.customer, UserRole.provider])
def test_non_admin_forbidden_on_admin_users(
    client: TestClient, make_user: Callable[..., User], role: UserRole
) -> None:
    user = make_user(role=role)
    other = make_user()
    headers = auth_headers(user)
    assert client.get(f"{API}/admin/users", headers=headers).status_code == 403
    response = client.patch(
        f"{API}/admin/users/{other.id}", json={"role": "admin"}, headers=headers
    )
    assert response.status_code == 403


def test_admin_lists_users_paginated_and_filtered(
    client: TestClient, make_user: Callable[..., User]
) -> None:
    admin = make_user(role=UserRole.admin)
    make_user(role=UserRole.provider)
    make_user(role=UserRole.provider)
    make_user()

    response = client.get(f"{API}/admin/users", headers=auth_headers(admin))
    assert response.status_code == 200
    body = response.json()
    assert body["total"] >= 4
    assert all("password_hash" not in item for item in body["items"])

    response = client.get(
        f"{API}/admin/users",
        params={"role": "provider", "limit": 1},
        headers=auth_headers(admin),
    )
    body = response.json()
    assert body["total"] >= 2
    assert len(body["items"]) == 1
    assert body["items"][0]["role"] == "provider"

    too_big = client.get(f"{API}/admin/users", params={"limit": 101}, headers=auth_headers(admin))
    assert too_big.status_code == 422


def test_admin_promotes_and_deactivates_other_user(
    client: TestClient, make_user: Callable[..., User]
) -> None:
    admin = make_user(role=UserRole.admin)
    target = make_user()
    response = client.patch(
        f"{API}/admin/users/{target.id}",
        json={"role": "provider", "is_active": False},
        headers=auth_headers(admin),
    )
    assert response.status_code == 200
    assert response.json()["role"] == "provider"
    assert response.json()["is_active"] is False


def test_admin_update_unknown_user_404(
    client: TestClient, make_user: Callable[..., User]
) -> None:
    admin = make_user(role=UserRole.admin)
    response = client.patch(
        f"{API}/admin/users/{uuid.uuid4()}", json={"is_active": False}, headers=auth_headers(admin)
    )
    assert response.status_code == 404


@pytest.mark.parametrize("payload", [{"role": "customer"}, {"is_active": False}])
def test_admin_cannot_demote_or_deactivate_self(
    client: TestClient, make_user: Callable[..., User], payload: dict[str, object]
) -> None:
    admin = make_user(role=UserRole.admin)
    response = client.patch(
        f"{API}/admin/users/{admin.id}", json=payload, headers=auth_headers(admin)
    )
    assert response.status_code == 400
    assert response.json() == {"detail": "cannot_modify_self"}


def test_users_me_update_only_full_name(
    client: TestClient, make_user: Callable[..., User]
) -> None:
    user = make_user()
    response = client.patch(
        f"{API}/users/me",
        json={"full_name": "Nuevo Nombre", "role": "admin", "is_active": False},
        headers=auth_headers(user),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["full_name"] == "Nuevo Nombre"
    assert body["role"] == "customer"
    assert body["is_active"] is True


def test_users_me_requires_token(client: TestClient) -> None:
    assert client.get(f"{API}/users/me").status_code == 401
