import uuid
from datetime import date, datetime

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

from app.models import BookingStatus


class BookingIn(BaseModel):
    provider_id: uuid.UUID
    service_id: uuid.UUID
    starts_at: AwareDatetime
    notes: str | None = Field(default=None, max_length=1000)


class BookingCancelIn(BaseModel):
    reason: str | None = Field(default=None, max_length=500)


class BookingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    customer_id: uuid.UUID
    provider_id: uuid.UUID
    service_id: uuid.UUID
    starts_at: datetime
    ends_at: datetime
    status: BookingStatus
    notes: str | None
    cancelled_by: uuid.UUID | None
    cancel_reason: str | None
    created_at: datetime
    updated_at: datetime


class BookingListOut(BaseModel):
    items: list[BookingOut]
    total: int


class DailyCountOut(BaseModel):
    date: date
    count: int


class TopServiceOut(BaseModel):
    service_id: uuid.UUID
    name: str
    count: int


class StatsOut(BaseModel):
    by_status: dict[BookingStatus, int]
    bookings_per_day: list[DailyCountOut]
    top_services: list[TopServiceOut]
    estimated_revenue_cents: int
