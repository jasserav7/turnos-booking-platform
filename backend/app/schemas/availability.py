import uuid
from datetime import datetime, time
from typing import Self

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator


class AvailabilityRuleIn(BaseModel):
    weekday: int = Field(ge=0, le=6)
    start_time: time
    end_time: time

    @model_validator(mode="after")
    def _check_order(self) -> Self:
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class AvailabilityRuleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    weekday: int
    start_time: time
    end_time: time


class TimeOffIn(BaseModel):
    starts_at: AwareDatetime
    ends_at: AwareDatetime
    reason: str | None = Field(default=None, max_length=255)

    @model_validator(mode="after")
    def _check_order(self) -> Self:
        if self.ends_at <= self.starts_at:
            raise ValueError("ends_at must be after starts_at")
        return self


class TimeOffOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    starts_at: datetime
    ends_at: datetime
    reason: str | None
