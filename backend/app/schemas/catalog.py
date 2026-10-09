import uuid

from pydantic import BaseModel, ConfigDict, Field


class ServiceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str
    duration_minutes: int
    price_cents: int
    is_active: bool


class ServiceListOut(BaseModel):
    items: list[ServiceOut]
    total: int


class ServiceIn(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str = Field(default="", max_length=5000)
    duration_minutes: int = Field(gt=0, le=24 * 60)
    price_cents: int = Field(default=0, ge=0)


class ServiceUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=5000)
    duration_minutes: int | None = Field(default=None, gt=0, le=24 * 60)
    price_cents: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


class ProviderServicesIn(BaseModel):
    service_ids: list[uuid.UUID]


class ProviderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
