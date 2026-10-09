import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.core.deps import DbSession, require_roles
from app.models import AvailabilityRule, TimeOff, User, UserRole
from app.schemas.availability import (
    AvailabilityRuleIn,
    AvailabilityRuleOut,
    TimeOffIn,
    TimeOffOut,
)
from app.services import availability

router = APIRouter(prefix="/providers/me", tags=["availability"])

ProviderUser = Annotated[User, Depends(require_roles(UserRole.provider))]


@router.get("/availability", response_model=list[AvailabilityRuleOut])
def get_availability(actor: ProviderUser, db: DbSession) -> list[AvailabilityRule]:
    return availability.list_rules(db, actor)


@router.put("/availability", response_model=list[AvailabilityRuleOut])
def replace_availability(
    rules: list[AvailabilityRuleIn], actor: ProviderUser, db: DbSession
) -> list[AvailabilityRule]:
    return availability.replace_rules(db, actor, rules)


@router.get("/time-off", response_model=list[TimeOffOut])
def list_time_off(actor: ProviderUser, db: DbSession) -> list[TimeOff]:
    return availability.list_time_off(db, actor)


@router.post("/time-off", response_model=TimeOffOut, status_code=status.HTTP_201_CREATED)
def create_time_off(data: TimeOffIn, actor: ProviderUser, db: DbSession) -> TimeOff:
    return availability.create_time_off(db, actor, data)


@router.delete("/time-off/{time_off_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_time_off(time_off_id: uuid.UUID, actor: ProviderUser, db: DbSession) -> None:
    availability.delete_time_off(db, actor, time_off_id)
