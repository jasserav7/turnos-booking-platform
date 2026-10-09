import os
import uuid
from collections.abc import Callable, Iterator
from dataclasses import dataclass, field

import pytest
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from alembic import command
from app.core.config import get_settings

TEST_DATABASE_URL = get_settings().test_database_url
if not TEST_DATABASE_URL:
    raise RuntimeError("TEST_DATABASE_URL must be set to run tests")

from app.core import email as email_core  # noqa: E402
from app.core.rate_limit import limiter  # noqa: E402
from app.core.security import create_access_token, hash_password  # noqa: E402
from app.db.session import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import User, UserRole  # noqa: E402

DEFAULT_PASSWORD = "Secreto123!"

test_engine = create_engine(TEST_DATABASE_URL)


@pytest.fixture(scope="session", autouse=True)
def _migrate() -> Iterator[None]:
    os.environ["ALEMBIC_DATABASE_URL"] = TEST_DATABASE_URL
    command.upgrade(Config("alembic.ini"), "head")
    yield
    os.environ.pop("ALEMBIC_DATABASE_URL", None)


@pytest.fixture
def session() -> Iterator[Session]:
    connection = test_engine.connect()
    transaction = connection.begin()
    db = Session(bind=connection, join_transaction_mode="create_savepoint")
    try:
        yield db
    finally:
        db.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def client(session: Session) -> Iterator[TestClient]:
    app.dependency_overrides[get_db] = lambda: session
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def _reset_rate_limits() -> None:
    limiter.reset()


@dataclass
class SentEmail:
    to: str
    subject: str
    html: str
    text: str


@dataclass
class FakeEmailSender:
    messages: list[SentEmail] = field(default_factory=list)

    def send(self, to: str, subject: str, html: str, text: str) -> None:
        self.messages.append(SentEmail(to, subject, html, text))

    def to(self, address: str) -> list[SentEmail]:
        return [m for m in self.messages if m.to == address]


@pytest.fixture(autouse=True)
def outbox(monkeypatch: pytest.MonkeyPatch) -> FakeEmailSender:
    sender = FakeEmailSender()
    monkeypatch.setattr(email_core, "get_email_sender", lambda: sender)
    return sender


@pytest.fixture
def make_user(session: Session) -> Callable[..., User]:
    def _make(
        role: UserRole = UserRole.customer,
        password: str = DEFAULT_PASSWORD,
        is_active: bool = True,
        email: str | None = None,
    ) -> User:
        user = User(
            email=email or f"{uuid.uuid4().hex}@example.com",
            password_hash=hash_password(password),
            full_name="Test User",
            role=role,
            is_active=is_active,
        )
        session.add(user)
        session.flush()
        return user

    return _make


def auth_headers(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user.id, user.role)}"}
