import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.core.deps import DbSession, require_roles
from app.models import User, UserRole
from app.schemas.user import AdminUserUpdateIn, UserListOut, UserOut
from app.services import users as users_service

router = APIRouter(prefix="/admin/users", tags=["admin"])

AdminUser = Annotated[User, Depends(require_roles(UserRole.admin))]


@router.get("", response_model=UserListOut)
def list_users(
    actor: AdminUser,
    db: DbSession,
    role: UserRole | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> UserListOut:
    items, total = users_service.list_users(db, actor, role, limit, offset)
    return UserListOut(items=[UserOut.model_validate(u) for u in items], total=total)


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: uuid.UUID, data: AdminUserUpdateIn, actor: AdminUser, db: DbSession
) -> User:
    return users_service.admin_update_user(db, actor, user_id, data)
