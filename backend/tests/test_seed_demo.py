from types import SimpleNamespace

import pytest

from app.scripts import seed_demo


def test_seed_demo_refuses_when_cookie_secure(monkeypatch: pytest.MonkeyPatch) -> None:
    def fail_session() -> None:
        raise AssertionError("must not open a database session")

    monkeypatch.setattr(seed_demo, "get_settings", lambda: SimpleNamespace(cookie_secure=True))
    monkeypatch.setattr(seed_demo, "SessionLocal", fail_session)

    with pytest.raises(SystemExit) as exc:
        seed_demo.main()

    assert "COOKIE_SECURE=true" in str(exc.value)
