from fastapi import APIRouter

from app.core.deps import CurrentUser, DbSession
from app.models import User
from app.schemas.user import UserOut, UserUpdateIn
from app.services import users as users_service

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserOut)
def read_me(user: CurrentUser) -> User:
    return user


@router.patch("/me", response_model=UserOut)
def update_me(data: UserUpdateIn, user: CurrentUser, db: DbSession) -> User:
    return users_service.update_me(db, user, data)
