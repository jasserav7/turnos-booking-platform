import uuid
from collections.abc import Callable
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import User, UserRole
from tests.conftest import auth_headers
from tests.factories import make_service, offer, tomorrow_at

API = "/api/v1"

SERVICE = {"name": "Manicure", "description": "Básico", "duration_minutes": 30, "price_cents": 2000}


def test_services_list_is_public_and_hides_inactive(client: TestClient, session: Session) -> None:
    active = make_service(session)
    inactive = make_service(session)
    inactive.is_active = False
    session.flush()

    response = client.get(f"{API}/services")
    assert response.status_code == 200
    ids = {s["id"] for s in response.json()}
    assert str(active.id) in ids
    assert str(inactive.id) not in ids


@pytest.mark.parametrize("role", [UserRole.customer, UserRole.provider])
def test_non_admin_cannot_manage_services(
    client: TestClient, session: Session, make_user: Callable[..., User], role: UserRole
) -> None:
    headers = auth_headers(make_user(role=role))
    service = make_service(session)
    provider = make_user(role=UserRole.provider)
    assert client.post(f"{API}/services", json=SERVICE, headers=headers).status_code == 403
    assert (
        client.patch(f"{API}/services/{service.id}", json={"name": "X"}, headers=headers)
    ).status_code == 403
    assert client.delete(f"{API}/services/{service.id}", headers=headers).status_code == 403
    response = client.put(
        f"{API}/admin/providers/{provider.id}/services",
        json={"service_ids": [str(service.id)]},
        headers=headers,
    )
    assert response.status_code == 403


def test_service_management_requires_token(client: TestClient) -> None:
    assert client.post(f"{API}/services", json=SERVICE).status_code == 401


def test_admin_manages_services(client: TestClient, make_user: Callable[..., User]) -> None:
    headers = auth_headers(make_user(role=UserRole.admin))
    created = client.post(f"{API}/services", json=SERVICE, headers=headers)
    assert created.status_code == 201
    service_id = created.json()["id"]

    updated = client.patch(
        f"{API}/services/{service_id}", json={"price_cents": 2500}, headers=headers
    )
    assert updated.status_code == 200
    assert updated.json()["price_cents"] == 2500
    assert updated.json()["name"] == SERVICE["name"]

    assert client.delete(f"{API}/services/{service_id}", headers=headers).status_code == 204
    assert service_id not in {s["id"] for s in client.get(f"{API}/services").json()}

    missing = client.patch(f"{API}/services/{uuid.uuid4()}", json={"name": "X"}, headers=headers)
    assert missing.status_code == 404


def test_admin_assigns_provider_services(
    client: TestClient, session: Session, make_user: Callable[..., User]
) -> None:
    headers = auth_headers(make_user(role=UserRole.admin))
    provider = make_user(role=UserRole.provider)
    inactive_provider = make_user(role=UserRole.provider, is_active=False)
    first, second = make_service(session), make_service(session)
    url = f"{API}/admin/providers/{provider.id}/services"

    assert (
        client.put(url, json={"service_ids": [str(first.id)]}, headers=headers).status_code == 200
    )
    response = client.put(url, json={"service_ids": [str(second.id)]}, headers=headers)
    assert [s["id"] for s in response.json()] == [str(second.id)]

    client.put(
        f"{API}/admin/providers/{inactive_provider.id}/services",
        json={"service_ids": [str(second.id)]},
        headers=headers,
    )
    listed = client.get(f"{API}/providers", params={"service_id": str(second.id)}).json()
    assert [p["id"] for p in listed] == [str(provider.id)]
    assert client.get(f"{API}/providers", params={"service_id": str(first.id)}).json() == []

    customer = make_user()
    response = client.put(
        f"{API}/admin/providers/{customer.id}/services",
        json={"service_ids": []},
        headers=headers,
    )
    assert response.status_code == 404
    assert response.json() == {"detail": "provider_not_found"}

    response = client.put(url, json={"service_ids": [str(uuid.uuid4())]}, headers=headers)
    assert response.status_code == 422
    assert response.json() == {"detail": "invalid_service"}


@pytest.mark.parametrize("role", [UserRole.customer, UserRole.admin])
def test_only_providers_manage_availability(
    client: TestClient, make_user: Callable[..., User], role: UserRole
) -> None:
    headers = auth_headers(make_user(role=role))
    assert client.get(f"{API}/providers/me/availability", headers=headers).status_code == 403
    assert (
        client.put(f"{API}/providers/me/availability", json=[], headers=headers).status_code == 403
    )
    assert client.get(f"{API}/providers/me/time-off", headers=headers).status_code == 403
    response = client.post(
        f"{API}/providers/me/time-off",
        json={
            "starts_at": tomorrow_at(9).isoformat(),
            "ends_at": tomorrow_at(10).isoformat(),
        },
        headers=headers,
    )
    assert response.status_code == 403
    assert (
        client.delete(f"{API}/providers/me/time-off/{uuid.uuid4()}", headers=headers)
    ).status_code == 403


def test_provider_replaces_availability(client: TestClient, make_user: Callable[..., User]) -> None:
    headers = auth_headers(make_user(role=UserRole.provider))
    url = f"{API}/providers/me/availability"
    rules = [
        {"weekday": 0, "start_time": "14:00", "end_time": "18:00"},
        {"weekday": 0, "start_time": "08:00", "end_time": "12:00"},
        {"weekday": 2, "start_time": "08:00", "end_time": "12:00"},
    ]
    response = client.put(url, json=rules, headers=headers)
    assert response.status_code == 200
    assert [(r["weekday"], r["start_time"]) for r in response.json()] == [
        (0, "08:00:00"),
        (0, "14:00:00"),
        (2, "08:00:00"),
    ]

    response = client.put(url, json=rules[:1], headers=headers)
    assert len(response.json()) == 1
    assert len(client.get(url, headers=headers).json()) == 1


def test_availability_validation(client: TestClient, make_user: Callable[..., User]) -> None:
    headers = auth_headers(make_user(role=UserRole.provider))
    url = f"{API}/providers/me/availability"
    overlapping = [
        {"weekday": 1, "start_time": "08:00", "end_time": "12:00"},
        {"weekday": 1, "start_time": "11:00", "end_time": "13:00"},
    ]
    response = client.put(url, json=overlapping, headers=headers)
    assert response.status_code == 422
    assert response.json() == {"detail": "overlapping_rules"}

    inverted = [{"weekday": 1, "start_time": "12:00", "end_time": "08:00"}]
    assert client.put(url, json=inverted, headers=headers).status_code == 422


def test_provider_manages_own_time_off(
    client: TestClient, session: Session, make_user: Callable[..., User]
) -> None:
    provider = make_user(role=UserRole.provider)
    service = make_service(session)
    offer(session, provider, service)
    headers = auth_headers(provider)
    url = f"{API}/providers/me/time-off"
    starts_at = tomorrow_at(9)
    day = tomorrow_at(12).date().isoformat()
    slots_url = f"{API}/providers/{provider.id}/slots"
    slot_params = {"service_id": str(service.id), "date_from": day, "date_to": day}

    created = client.post(
        url,
        json={
            "starts_at": starts_at.isoformat(),
            "ends_at": (starts_at + timedelta(hours=2)).isoformat(),
            "reason": "Médico",
        },
        headers=headers,
    )
    assert created.status_code == 201
    time_off_id = created.json()["id"]
    assert [t["id"] for t in client.get(url, headers=headers).json()] == [time_off_id]
    assert len(client.get(slots_url, params=slot_params).json()) == 8

    other_headers = auth_headers(make_user(role=UserRole.provider))
    assert client.delete(f"{url}/{time_off_id}", headers=other_headers).status_code == 404

    assert client.delete(f"{url}/{time_off_id}", headers=headers).status_code == 204
    assert client.get(url, headers=headers).json() == []
    assert len(client.get(slots_url, params=slot_params).json()) == 10

    inverted = {"starts_at": starts_at.isoformat(), "ends_at": starts_at.isoformat()}
    assert client.post(url, json=inverted, headers=headers).status_code == 422


def test_slots_range_validation(
    client: TestClient, session: Session, make_user: Callable[..., User]
) -> None:
    provider = make_user(role=UserRole.provider)
    service = make_service(session)
    offer(session, provider, service)
    url = f"{API}/providers/{provider.id}/slots"
    start = tomorrow_at(12).date()

    params = {
        "service_id": str(service.id),
        "date_from": start.isoformat(),
        "date_to": (start + timedelta(days=31)).isoformat(),
    }
    response = client.get(url, params=params)
    assert response.status_code == 422
    assert response.json() == {"detail": "range_too_large"}

    params["date_to"] = (start - timedelta(days=1)).isoformat()
    assert client.get(url, params=params).json() == {"detail": "invalid_range"}

    params["date_to"] = start.isoformat()
    params["service_id"] = str(make_service(session).id)
    assert client.get(url, params=params).status_code == 404


@pytest.mark.parametrize("role", [UserRole.customer, UserRole.provider])
def test_admin_catalog_endpoints_require_admin(
    client: TestClient, make_user: Callable[..., User], role: UserRole
) -> None:
    headers = auth_headers(make_user(role=role))
    provider = make_user(role=UserRole.provider)
    assert client.get(f"{API}/admin/services", headers=headers).status_code == 403
    response = client.get(f"{API}/admin/providers/{provider.id}/services", headers=headers)
    assert response.status_code == 403
    assert client.get(f"{API}/admin/services").status_code == 401


def test_admin_lists_all_services_including_inactive(
    client: TestClient, session: Session, make_user: Callable[..., User]
) -> None:
    headers = auth_headers(make_user(role=UserRole.admin))
    active = make_service(session)
    inactive = make_service(session)
    inactive.is_active = False
    session.flush()

    body = client.get(f"{API}/admin/services", params={"limit": 100}, headers=headers).json()
    by_id = {s["id"]: s for s in body["items"]}
    assert by_id[str(active.id)]["is_active"] is True
    assert by_id[str(inactive.id)]["is_active"] is False
    assert body["total"] >= 2

    page = client.get(f"{API}/admin/services", params={"limit": 1}, headers=headers).json()
    assert len(page["items"]) == 1
    assert page["total"] == body["total"]
    second = client.get(
        f"{API}/admin/services", params={"limit": 1, "offset": 1}, headers=headers
    ).json()
    assert second["items"][0]["id"] != page["items"][0]["id"]
    too_big = client.get(f"{API}/admin/services", params={"limit": 101}, headers=headers)
    assert too_big.status_code == 422


def test_admin_gets_provider_services_including_inactive(
    client: TestClient, session: Session, make_user: Callable[..., User]
) -> None:
    headers = auth_headers(make_user(role=UserRole.admin))
    provider = make_user(role=UserRole.provider)
    active, inactive, unassigned = (
        make_service(session),
        make_service(session),
        make_service(session),
    )
    inactive.is_active = False
    session.flush()
    url = f"{API}/admin/providers/{provider.id}/services"

    assert client.get(url, headers=headers).json() == []
    payload = {"service_ids": [str(active.id), str(inactive.id)]}
    assert client.put(url, json=payload, headers=headers).status_code == 200

    response = client.get(url, headers=headers)
    assert response.status_code == 200
    assert {s["id"] for s in response.json()} == {str(active.id), str(inactive.id)}
    assert str(unassigned.id) not in {s["id"] for s in response.json()}

    customer = make_user()
    for missing in (customer.id, uuid.uuid4()):
        response = client.get(f"{API}/admin/providers/{missing}/services", headers=headers)
        assert response.status_code == 404
        assert response.json() == {"detail": "provider_not_found"}
