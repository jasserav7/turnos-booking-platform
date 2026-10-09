import uuid

from fastapi import HTTPException, status
from sqlalchemy import Select, delete, select
from sqlalchemy.orm import Session

from app.models import AvailabilityRule, TimeOff, User, UserRole
from app.schemas.availability import AvailabilityRuleIn, TimeOffIn
from app.services.permissions import ensure_roles


def _rules_query(provider_id: uuid.UUID) -> Select[tuple[AvailabilityRule]]:
    return (
        select(AvailabilityRule)
        .where(AvailabilityRule.provider_id == provider_id)
        .order_by(AvailabilityRule.weekday, AvailabilityRule.start_time)
    )


def list_rules(db: Session, actor: User) -> list[AvailabilityRule]:
    ensure_roles(actor, UserRole.provider)
    return list(db.scalars(_rules_query(actor.id)))


def replace_rules(
    db: Session, actor: User, rules: list[AvailabilityRuleIn]
) -> list[AvailabilityRule]:
    ensure_roles(actor, UserRole.provider)
    ordered = sorted(rules, key=lambda r: (r.weekday, r.start_time))
    for rule in ordered:
        if rule.end_time <= rule.start_time:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="invalid_rule"
            )
    for prev, curr in zip(ordered, ordered[1:], strict=False):
        if prev.weekday == curr.weekday and curr.start_time < prev.end_time:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="overlapping_rules"
            )
    db.execute(delete(AvailabilityRule).where(AvailabilityRule.provider_id == actor.id))
    db.add_all(AvailabilityRule(provider_id=actor.id, **r.model_dump()) for r in ordered)
    db.commit()
    return list(db.scalars(_rules_query(actor.id)))


def list_time_off(db: Session, actor: User) -> list[TimeOff]:
    ensure_roles(actor, UserRole.provider)
    query = select(TimeOff).where(TimeOff.provider_id == actor.id).order_by(TimeOff.starts_at)
    return list(db.scalars(query))


def create_time_off(db: Session, actor: User, data: TimeOffIn) -> TimeOff:
    ensure_roles(actor, UserRole.provider)
    time_off = TimeOff(provider_id=actor.id, **data.model_dump())
    db.add(time_off)
    db.commit()
    db.refresh(time_off)
    return time_off


def delete_time_off(db: Session, actor: User, time_off_id: uuid.UUID) -> None:
    ensure_roles(actor, UserRole.provider)
    time_off = db.get(TimeOff, time_off_id)
    if time_off is None or time_off.provider_id != actor.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="time_off_not_found")
    db.delete(time_off)
    db.commit()
