from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Cookie, Request, Response, status

from app.core.config import get_settings
from app.core.deps import DbSession
from app.core.rate_limit import limiter
from app.core.security import REFRESH_TOKEN_TTL
from app.models import User
from app.schemas.auth import ForgotPasswordIn, LoginIn, RegisterIn, ResetPasswordIn, TokenOut
from app.schemas.user import UserOut
from app.services import auth as auth_service

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE = "refresh_token"
COOKIE_PATH = "/api/v1/auth"

RefreshCookie = Annotated[str | None, Cookie(alias=REFRESH_COOKIE)]


def _set_refresh_cookie(response: Response, raw: str) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=raw,
        max_age=int(REFRESH_TOKEN_TTL.total_seconds()),
        path=COOKIE_PATH,
        httponly=True,
        samesite="lax",
        secure=get_settings().cookie_secure,
    )


def _token_response(response: Response, result: auth_service.AuthResult) -> TokenOut:
    user, access_token, raw_refresh = result
    _set_refresh_cookie(response, raw_refresh)
    return TokenOut(access_token=access_token, user=UserOut.model_validate(user))


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(data: RegisterIn, db: DbSession, tasks: BackgroundTasks) -> User:
    return auth_service.register(db, data, tasks)


@router.post("/login", response_model=TokenOut)
@limiter.limit("5/minute")
def login(request: Request, response: Response, data: LoginIn, db: DbSession) -> TokenOut:
    return _token_response(response, auth_service.login(db, data.email, data.password))


@router.post("/refresh", response_model=TokenOut)
def refresh(response: Response, db: DbSession, refresh_token: RefreshCookie = None) -> TokenOut:
    return _token_response(response, auth_service.refresh(db, refresh_token))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response, db: DbSession, refresh_token: RefreshCookie = None) -> None:
    auth_service.logout(db, refresh_token)
    response.delete_cookie(
        key=REFRESH_COOKIE,
        path=COOKIE_PATH,
        httponly=True,
        samesite="lax",
        secure=get_settings().cookie_secure,
    )


@router.get("/verify-email")
def verify_email(token: str, db: DbSession) -> dict[str, str]:
    auth_service.verify_email(db, token)
    return {"detail": "email_verified"}


@router.post("/forgot-password", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("3/minute")
def forgot_password(
    request: Request, data: ForgotPasswordIn, db: DbSession, tasks: BackgroundTasks
) -> dict[str, str]:
    auth_service.forgot_password(db, data.email, tasks)
    return {"detail": "accepted"}


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
def reset_password(data: ResetPasswordIn, db: DbSession) -> None:
    auth_service.reset_password(db, data.token, data.new_password)
