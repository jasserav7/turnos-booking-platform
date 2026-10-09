import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import User, UserRole
from app.schemas.user import AdminUserUpdateIn, UserUpdateIn


def _ensure_admin(actor: User) -> None:
    if actor.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")


def update_me(db: Session, user: User, data: UserUpdateIn) -> User:
    user.full_name = data.full_name.strip()
    db.commit()
    db.refresh(user)
    return user


def list_users(
    db: Session, actor: User, role: UserRole | None, limit: int, offset: int
) -> tuple[list[User], int]:
    _ensure_admin(actor)
    query = select(User)
    if role is not None:
        query = query.where(User.role == role)
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    items = db.scalars(query.order_by(User.created_at, User.id).limit(limit).offset(offset))
    return list(items), total


def admin_update_user(
    db: Session, actor: User, user_id: uuid.UUID, data: AdminUserUpdateIn
) -> User:
    _ensure_admin(actor)
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="user_not_found")
    if user.id == actor.id and (
        (data.role is not None and data.role != UserRole.admin) or data.is_active is False
    ):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="cannot_modify_self")
    if data.role is not None:
        user.role = data.role
    if data.is_active is not None:
        user.is_active = data.is_active
    db.commit()
    db.refresh(user)
    return user
