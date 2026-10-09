import uuid
from datetime import UTC, datetime
from typing import Any

import jwt
from fastapi import BackgroundTasks, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core import notifications
from app.core.security import (
    REFRESH_TOKEN_TTL,
    TokenType,
    create_access_token,
    create_reset_token,
    create_verify_token,
    decode_token,
    dummy_verify_password,
    generate_refresh_token,
    hash_password,
    hash_token,
    password_fingerprint,
    verify_password,
)
from app.models import RefreshToken, User, UserRole
from app.schemas.auth import RegisterIn

AuthResult = tuple[User, str, str]
"""(user, access_token, raw_refresh_token)"""


def _unauthorized(detail: str = "invalid_token") -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)


def _invalid_link_token() -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_token")


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _issue_tokens(db: Session, user: User, family_id: uuid.UUID) -> AuthResult:
    raw = generate_refresh_token()
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_token(raw),
            family_id=family_id,
            expires_at=datetime.now(UTC) + REFRESH_TOKEN_TTL,
        )
    )
    db.commit()
    return user, create_access_token(user.id, user.role), raw


def _revoke_user_tokens(db: Session, user_id: uuid.UUID) -> None:
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )


def _user_from_link_token(db: Session, token: str, token_type: TokenType) -> tuple[User, Any]:
    try:
        payload = decode_token(token, token_type)
        user_id = uuid.UUID(payload["sub"])
    except (jwt.InvalidTokenError, ValueError) as exc:
        raise _invalid_link_token() from exc
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise _invalid_link_token()
    return user, payload


def register(db: Session, data: RegisterIn, tasks: BackgroundTasks) -> User:
    email = _normalize_email(data.email)
    if db.scalar(select(User.id).where(User.email == email)) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="email_taken")
    user = User(
        email=email,
        password_hash=hash_password(data.password),
        full_name=data.full_name.strip(),
        role=UserRole.customer,
        is_active=True,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="email_taken") from exc
    db.refresh(user)
    tasks.add_task(notifications.notify_verify_email, user, create_verify_token(user.id))
    return user


def login(db: Session, email: str, password: str) -> AuthResult:
    user = db.scalar(select(User).where(User.email == _normalize_email(email)))
    if user is None:
        dummy_verify_password(password)
        raise _unauthorized("invalid_credentials")
    if not verify_password(password, user.password_hash) or not user.is_active:
        raise _unauthorized("invalid_credentials")
    return _issue_tokens(db, user, uuid.uuid4())


def refresh(db: Session, raw: str | None) -> AuthResult:
    if not raw:
        raise _unauthorized()
    token = db.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == hash_token(raw)).with_for_update()
    )
    if token is None:
        raise _unauthorized()
    now = datetime.now(UTC)
    if token.revoked_at is not None:
        # Reuse of a rotated token: assume theft and kill the whole family.
        db.execute(
            update(RefreshToken)
            .where(RefreshToken.family_id == token.family_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=now)
        )
        db.commit()
        raise _unauthorized()
    if token.expires_at <= now:
        raise _unauthorized()
    user = db.get(User, token.user_id)
    if user is None or not user.is_active:
        raise _unauthorized()
    token.revoked_at = now
    return _issue_tokens(db, user, token.family_id)


def logout(db: Session, raw: str | None) -> None:
    if not raw:
        return
    token = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_token(raw)))
    if token is not None and token.revoked_at is None:
        token.revoked_at = datetime.now(UTC)
        db.commit()


def verify_email(db: Session, token: str) -> None:
    user, _ = _user_from_link_token(db, token, "verify")
    if user.email_verified_at is None:
        user.email_verified_at = datetime.now(UTC)
        db.commit()


def forgot_password(db: Session, email: str, tasks: BackgroundTasks) -> None:
    user = db.scalar(select(User).where(User.email == _normalize_email(email)))
    if user is not None and user.is_active:
        tasks.add_task(
            notifications.notify_password_reset,
            user,
            create_reset_token(user.id, user.password_hash),
        )


def reset_password(db: Session, token: str, new_password: str) -> None:
    user, payload = _user_from_link_token(db, token, "reset")
    if payload.get("pwd") != password_fingerprint(user.password_hash):
        raise _invalid_link_token()
    user.password_hash = hash_password(new_password)
    _revoke_user_tokens(db, user.id)
    db.commit()
