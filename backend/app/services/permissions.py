from fastapi import HTTPException, status

from app.models import User, UserRole


def ensure_roles(actor: User, *roles: UserRole) -> None:
    if actor.role not in roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")
