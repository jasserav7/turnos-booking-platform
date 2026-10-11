import uuid
from datetime import timedelta
from typing import Any

import jwt

from app.core.config import get_settings
from app.core.security import ALGORITHM, _encode, create_access_token, decode_token
from app.models import UserRole


def test_extra_claims_cannot_override_fixed_claims() -> None:
    forged: dict[str, Any] = {"type": "reset", "sub": "attacker", "role": "admin"}
    token = _encode("user-1", "access", timedelta(minutes=5), forged)
    payload = jwt.decode(token, get_settings().secret_key, algorithms=[ALGORITHM])
    assert payload["type"] == "access"
    assert payload["sub"] == "user-1"
    assert decode_token(token, "access")["sub"] == "user-1"


def test_access_token_role_uses_enum_value() -> None:
    token = create_access_token(uuid.uuid4(), UserRole.provider)
    assert decode_token(token, "access")["role"] == "provider"
