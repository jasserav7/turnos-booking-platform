import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

import jwt
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher

from app.core.config import get_settings

ALGORITHM = "HS256"
ACCESS_TOKEN_TTL = timedelta(minutes=15)
REFRESH_TOKEN_TTL = timedelta(days=7)
VERIFY_TOKEN_TTL = timedelta(hours=24)
RESET_TOKEN_TTL = timedelta(minutes=30)

TokenType = Literal["access", "verify", "reset"]

_password_hash = PasswordHash((Argon2Hasher(),))
_dummy_hash: str | None = None


def hash_password(password: str) -> str:
    return _password_hash.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return _password_hash.verify(password, password_hash)


def dummy_verify_password(password: str) -> None:
    """Spend the same time as a real verification to avoid user enumeration by timing."""
    global _dummy_hash
    if _dummy_hash is None:
        _dummy_hash = _password_hash.hash(secrets.token_urlsafe(16))
    _password_hash.verify(password, _dummy_hash)


def _encode(
    subject: str, token_type: TokenType, ttl: timedelta, extra: dict[str, Any] | None = None
) -> str:
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": subject,
        "type": token_type,
        "iat": now,
        "exp": now + ttl,
        **(extra or {}),
    }
    return jwt.encode(payload, get_settings().secret_key, algorithm=ALGORITHM)


def create_access_token(user_id: uuid.UUID, role: str, ttl: timedelta = ACCESS_TOKEN_TTL) -> str:
    return _encode(str(user_id), "access", ttl, {"role": str(role)})


def create_verify_token(user_id: uuid.UUID, ttl: timedelta = VERIFY_TOKEN_TTL) -> str:
    return _encode(str(user_id), "verify", ttl)


def password_fingerprint(password_hash: str) -> str:
    return hashlib.sha256(password_hash.encode()).hexdigest()[:16]


def create_reset_token(
    user_id: uuid.UUID, password_hash: str, ttl: timedelta = RESET_TOKEN_TTL
) -> str:
    return _encode(str(user_id), "reset", ttl, {"pwd": password_fingerprint(password_hash)})


def decode_token(token: str, expected_type: TokenType) -> dict[str, Any]:
    """Decode and validate a JWT. Raises jwt.InvalidTokenError on any problem."""
    payload: dict[str, Any] = jwt.decode(
        token,
        get_settings().secret_key,
        algorithms=[ALGORITHM],
        options={"require": ["sub", "type", "iat", "exp"]},
    )
    if payload.get("type") != expected_type:
        raise jwt.InvalidTokenError("unexpected token type")
    return payload


def generate_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()
