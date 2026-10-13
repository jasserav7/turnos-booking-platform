import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models import UserRole


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str
    role: UserRole
    is_active: bool
    email_verified_at: datetime | None
    created_at: datetime


# No C0 control characters or DEL: they break downstream formats such as XLSX.
PRINTABLE_TEXT = r"^[^\x00-\x1f\x7f]+$"


class UserUpdateIn(BaseModel):
    full_name: str = Field(min_length=1, max_length=255, pattern=PRINTABLE_TEXT)


class AdminUserUpdateIn(BaseModel):
    role: UserRole | None = None
    is_active: bool | None = None


class UserListOut(BaseModel):
    items: list[UserOut]
    total: int
