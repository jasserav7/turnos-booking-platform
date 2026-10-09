import threading
from collections.abc import Callable, Iterator
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, event
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.main import app
from app.models import Booking, BookingStatus, ProviderService, Service, User, UserRole
from app.services import catalog
from tests.conftest import auth_headers, test_engine
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
        "admin": make_user(role=UserRole.admin),
    }


def _payload(world: dict[str, Any], starts_at: datetime) -> dict[str, str]:
    return {
        "provider_id": str(world["provider"].id),
        "service_id": str(world["service"].id),
        "starts_at": starts_at.isoformat(),
    }


def test_happy_flow(client: TestClient, world: dict[str, Any]) -> None:
    customer, provider = world["customer"], world["provider"]
    starts_at = tomorrow_at(10)
    day = tomorrow_at(12).date().isoformat()
    slots_url = f"{API}/providers/{provider.id}/slots"
    params = {"service_id": str(world["service"].id), "date_from": day, "date_to": day}

    slots = client.get(slots_url, params=params)
    assert slots.status_code == 200
    assert starts_at in [datetime.fromisoformat(s) for s in slots.json()]

    created = client.post(
        f"{API}/bookings", json=_payload(world, starts_at), headers=auth_headers(customer)
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["status"] == "pending"
    assert datetime.fromisoformat(body["ends_at"]) == starts_at + timedelta(minutes=60)

    slots_after = [datetime.fromisoformat(s) for s in client.get(slots_url, params=params).json()]
    assert starts_at not in slots_after

    booking_url = f"{API}/bookings/{body['id']}"
    confirmed = client.post(f"{booking_url}/confirm", headers=auth_headers(provider))
    assert confirmed.status_code == 200
    assert confirmed.json()["status"] == "confirmed"

    cancelled = client.post(
        f"{booking_url}/cancel", json={"reason": "No puedo"}, headers=auth_headers(customer)
    )
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"
    assert cancelled.json()["cancelled_by"] == str(customer.id)
    assert cancelled.json()["cancel_reason"] == "No puedo"


@pytest.mark.parametrize("hour,minute", [(7, 0), (10, 30), (18, 0)])
def test_slot_outside_availability_conflicts(
    client: TestClient, world: dict[str, Any], hour: int, minute: int
) -> None:
    response = client.post(
        f"{API}/bookings",
        json=_payload(world, tomorrow_at(hour, minute)),
        headers=auth_headers(world["customer"]),
    )
    assert response.status_code == 409
    assert response.json() == {"detail": "slot_unavailable"}


def test_taken_slot_conflicts(
    client: TestClient, session: Session, world: dict[str, Any], make_user: Callable[..., User]
) -> None:
    starts_at = tomorrow_at(10)
    insert_booking(session, make_user(), world["provider"], world["service"], starts_at)
    response = client.post(
        f"{API}/bookings", json=_payload(world, starts_at), headers=auth_headers(world["customer"])
    )
    assert response.status_code == 409
    assert response.json() == {"detail": "slot_unavailable"}


def test_constraint_blocks_double_booking_even_without_validation(
    client: TestClient,
    session: Session,
    world: dict[str, Any],
    make_user: Callable[..., User],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    starts_at = tomorrow_at(10)
    insert_booking(session, make_user(), world["provider"], world["service"], starts_at)
    monkeypatch.setattr(catalog, "compute_slots", lambda *args, **kwargs: [starts_at])
    response = client.post(
        f"{API}/bookings", json=_payload(world, starts_at), headers=auth_headers(world["customer"])
    )
    assert response.status_code == 409
    assert response.json() == {"detail": "slot_unavailable"}


def test_inactive_or_unoffered_service_not_found(
    client: TestClient, session: Session, world: dict[str, Any]
) -> None:
    headers = auth_headers(world["customer"])
    other = make_service(session)
    payload = {**_payload(world, tomorrow_at(10)), "service_id": str(other.id)}
    response = client.post(f"{API}/bookings", json=payload, headers=headers)
    assert response.status_code == 404
    assert response.json() == {"detail": "provider_not_found"}

    world["service"].is_active = False
    session.flush()
    response = client.post(
        f"{API}/bookings", json=_payload(world, tomorrow_at(10)), headers=headers
    )
    assert response.status_code == 404
    assert response.json() == {"detail": "service_not_found"}


def test_only_customers_create_bookings(client: TestClient, world: dict[str, Any]) -> None:
    for actor in (world["provider"], world["admin"]):
        response = client.post(
            f"{API}/bookings", json=_payload(world, tomorrow_at(10)), headers=auth_headers(actor)
        )
        assert response.status_code == 403


def test_invalid_transitions(client: TestClient, session: Session, world: dict[str, Any]) -> None:
    customer, provider, service = world["customer"], world["provider"], world["service"]
    headers = auth_headers(provider)

    pending = insert_booking(session, customer, provider, service, tomorrow_at(9))
    response = client.post(f"{API}/bookings/{pending.id}/complete", headers=headers)
    assert response.status_code == 409
    assert response.json() == {"detail": "invalid_transition"}

    cancelled = insert_booking(
        session, customer, provider, service, tomorrow_at(10), BookingStatus.cancelled
    )
    for action in ("confirm", "cancel", "complete"):
        response = client.post(f"{API}/bookings/{cancelled.id}/{action}", headers=headers)
        assert response.status_code == 409
        assert response.json() == {"detail": "invalid_transition"}

    future = insert_booking(
        session, customer, provider, service, tomorrow_at(11), BookingStatus.confirmed
    )
    response = client.post(f"{API}/bookings/{future.id}/complete", headers=headers)
    assert response.status_code == 409

    started = insert_booking(
        session,
        customer,
        provider,
        service,
        datetime.now(UTC) - timedelta(hours=2),
        BookingStatus.confirmed,
    )
    response = client.post(f"{API}/bookings/{started.id}/complete", headers=headers)
    assert response.status_code == 200
    assert response.json()["status"] == "completed"


def test_customer_cannot_confirm(
    client: TestClient, session: Session, world: dict[str, Any]
) -> None:
    booking = insert_booking(
        session, world["customer"], world["provider"], world["service"], tomorrow_at(9)
    )
    response = client.post(
        f"{API}/bookings/{booking.id}/confirm", headers=auth_headers(world["customer"])
    )
    assert response.status_code == 403


def test_customer_cancel_window(
    client: TestClient, session: Session, world: dict[str, Any]
) -> None:
    soon = datetime.now(UTC) + timedelta(hours=1)
    booking = insert_booking(session, world["customer"], world["provider"], world["service"], soon)
    url = f"{API}/bookings/{booking.id}/cancel"

    response = client.post(url, headers=auth_headers(world["customer"]))
    assert response.status_code == 409
    assert response.json() == {"detail": "cancellation_window_closed"}

    response = client.post(url, headers=auth_headers(world["provider"]))
    assert response.status_code == 200
    assert response.json()["cancelled_by"] == str(world["provider"].id)


def test_customer_cannot_see_others_bookings(
    client: TestClient, session: Session, world: dict[str, Any], make_user: Callable[..., User]
) -> None:
    booking = insert_booking(
        session, make_user(), world["provider"], world["service"], tomorrow_at(9)
    )
    headers = auth_headers(world["customer"])
    assert client.get(f"{API}/bookings/{booking.id}", headers=headers).status_code == 404
    assert client.post(f"{API}/bookings/{booking.id}/cancel", headers=headers).status_code == 404
    listed = client.get(f"{API}/bookings", headers=headers).json()
    assert listed == {"items": [], "total": 0}


def test_provider_sees_only_own_bookings(
    client: TestClient, session: Session, world: dict[str, Any], make_user: Callable[..., User]
) -> None:
    other_provider = make_user(role=UserRole.provider)
    customer, service = world["customer"], world["service"]
    own = insert_booking(session, customer, world["provider"], service, tomorrow_at(9))
    foreign = insert_booking(session, customer, other_provider, service, tomorrow_at(9))
    headers = auth_headers(world["provider"])

    listed = client.get(f"{API}/bookings", headers=headers).json()
    assert [item["id"] for item in listed["items"]] == [str(own.id)]
    assert listed["total"] == 1
    assert client.get(f"{API}/bookings/{foreign.id}", headers=headers).status_code == 404
    response = client.post(f"{API}/bookings/{foreign.id}/confirm", headers=headers)
    assert response.status_code == 404


def test_admin_lists_with_filters(
    client: TestClient, session: Session, world: dict[str, Any]
) -> None:
    customer, provider, service = world["customer"], world["provider"], world["service"]
    insert_booking(session, customer, provider, service, tomorrow_at(9))
    insert_booking(session, customer, provider, service, tomorrow_at(10), BookingStatus.confirmed)
    insert_booking(session, customer, provider, service, tomorrow_at(11), BookingStatus.confirmed)
    headers = auth_headers(world["admin"])
    day = tomorrow_at(12).date().isoformat()

    response = client.get(
        f"{API}/bookings",
        params={"status": "confirmed", "date_from": day, "date_to": day, "limit": 1},
        headers=headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["total"] >= 2
    assert len(body["items"]) == 1
    assert body["items"][0]["status"] == "confirmed"

    assert client.get(f"{API}/bookings", params={"limit": 101}, headers=headers).status_code == 422


def test_admin_stats(client: TestClient, session: Session, world: dict[str, Any]) -> None:
    customer, provider, service = world["customer"], world["provider"], world["service"]
    insert_booking(
        session,
        customer,
        provider,
        service,
        datetime.now(UTC) - timedelta(days=1),
        BookingStatus.completed,
    )
    assert client.get(f"{API}/admin/stats", headers=auth_headers(customer)).status_code == 403

    response = client.get(f"{API}/admin/stats", headers=auth_headers(world["admin"]))
    assert response.status_code == 200
    body = response.json()
    assert set(body["by_status"]) == {"pending", "confirmed", "cancelled", "completed"}
    assert body["by_status"]["completed"] >= 1
    assert len(body["bookings_per_day"]) == 30
    assert sum(d["count"] for d in body["bookings_per_day"]) >= 1
    assert any(s["service_id"] == str(service.id) for s in body["top_services"])
    assert body["estimated_revenue_cents"] >= service.price_cents


@pytest.fixture
def committed_world() -> Iterator[dict[str, Any]]:
    """Data committed for real so that separate sessions can see it."""
    with Session(test_engine, expire_on_commit=False) as db:
        provider = User(
            email=f"race-provider-{datetime.now().timestamp()}@example.com",
            password_hash="x",
            full_name="Provider",
            role=UserRole.provider,
        )
        customers = [
            User(
                email=f"race-customer-{i}-{datetime.now().timestamp()}@example.com",
                password_hash="x",
                full_name="Customer",
                role=UserRole.customer,
            )
            for i in range(2)
        ]
        db.add_all([provider, *customers])
        service = make_service(db)
        offer(db, provider, service)
        db.commit()
    yield {"provider": provider, "service": service, "customers": customers}
    with Session(test_engine) as db:
        db.execute(delete(Booking).where(Booking.provider_id == provider.id))
        db.execute(delete(ProviderService).where(ProviderService.provider_id == provider.id))
        db.execute(delete(User).where(User.id.in_([provider.id, *(c.id for c in customers)])))
        db.execute(delete(Service).where(Service.id == service.id))
        db.commit()


def test_concurrent_bookings_only_one_wins(
    committed_world: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    def real_db() -> Iterator[Session]:
        db = Session(test_engine, expire_on_commit=False)
        try:
            yield db
        finally:
            db.close()

    # Both requests pass application validation before either inserts, so the
    # database exclusion constraint is what must reject the loser.
    barrier = threading.Barrier(2, timeout=10)
    original_compute = catalog.compute_slots

    def synchronized_compute(*args: Any, **kwargs: Any) -> list[datetime]:
        slots = original_compute(*args, **kwargs)
        barrier.wait()
        return slots

    monkeypatch.setattr(catalog, "compute_slots", synchronized_compute)
    app.dependency_overrides[get_db] = real_db
    starts_at = tomorrow_at(10)
    statuses: list[int] = []
    lock = threading.Lock()

    def book(customer: User) -> None:
        with TestClient(app) as c:
            response = c.post(
                f"{API}/bookings",
                json=_payload(committed_world, starts_at),
                headers=auth_headers(customer),
            )
        with lock:
            statuses.append(response.status_code)

    try:
        threads = [threading.Thread(target=book, args=(c,)) for c in committed_world["customers"]]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=30)
    finally:
        app.dependency_overrides.clear()

    assert sorted(statuses) == [201, 409]


def test_bookings_include_names(
    client: TestClient, session: Session, world: dict[str, Any], make_user: Callable[..., User]
) -> None:
    customer, provider, service = world["customer"], world["provider"], world["service"]
    created = client.post(
        f"{API}/bookings", json=_payload(world, tomorrow_at(10)), headers=auth_headers(customer)
    )
    assert created.status_code == 201
    expected = {
        "customer_name": customer.full_name,
        "provider_name": provider.full_name,
        "service_name": service.name,
    }
    assert {k: created.json()[k] for k in expected} == expected
    booking_id = created.json()["id"]

    other = insert_booking(session, make_user(), provider, service, tomorrow_at(12))
    for actor in (customer, provider, world["admin"]):
        detail = client.get(f"{API}/bookings/{booking_id}", headers=auth_headers(actor)).json()
        assert {k: detail[k] for k in expected} == expected
        items = client.get(f"{API}/bookings", headers=auth_headers(actor)).json()["items"]
        mine = next(item for item in items if item["id"] == booking_id)
        assert {k: mine[k] for k in expected} == expected

    customer_items = client.get(f"{API}/bookings", headers=auth_headers(customer)).json()["items"]
    assert [item["id"] for item in customer_items] == [booking_id]
    assert str(other.id) not in {i["id"] for i in customer_items}


def test_booking_list_has_no_n_plus_one(
    client: TestClient, session: Session, world: dict[str, Any], make_user: Callable[..., User]
) -> None:
    provider = world["provider"]
    headers = auth_headers(provider)

    def count_queries() -> int:
        statements: list[str] = []

        def listener(*args: Any) -> None:
            statements.append(args[2])

        event.listen(test_engine, "before_cursor_execute", listener)
        try:
            response = client.get(f"{API}/bookings", headers=headers)
        finally:
            event.remove(test_engine, "before_cursor_execute", listener)
        assert response.status_code == 200
        return len(statements)

    insert_booking(session, make_user(), provider, world["service"], tomorrow_at(9))
    baseline = count_queries()
    for hour in (10, 11, 12, 13):
        other_service = make_service(session)
        insert_booking(session, make_user(), provider, other_service, tomorrow_at(hour))
    assert count_queries() == baseline
