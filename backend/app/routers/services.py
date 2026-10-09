import uuid
from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.core.deps import DbSession, require_roles
from app.models import Service, User, UserRole
from app.schemas.catalog import (
    ProviderOut,
    ProviderServicesIn,
    ServiceIn,
    ServiceListOut,
    ServiceOut,
    ServiceUpdateIn,
)
from app.services import catalog

router = APIRouter(tags=["catalog"])

AdminUser = Annotated[User, Depends(require_roles(UserRole.admin))]


@router.get("/services", response_model=list[ServiceOut])
def list_services(db: DbSession) -> list[Service]:
    return catalog.list_services(db)


@router.post("/services", response_model=ServiceOut, status_code=status.HTTP_201_CREATED)
def create_service(data: ServiceIn, actor: AdminUser, db: DbSession) -> Service:
    return catalog.create_service(db, actor, data)


@router.patch("/services/{service_id}", response_model=ServiceOut)
def update_service(
    service_id: uuid.UUID, data: ServiceUpdateIn, actor: AdminUser, db: DbSession
) -> Service:
    return catalog.update_service(db, actor, service_id, data)


@router.delete("/services/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_service(service_id: uuid.UUID, actor: AdminUser, db: DbSession) -> None:
    catalog.deactivate_service(db, actor, service_id)


@router.get("/admin/services", response_model=ServiceListOut)
def admin_list_services(
    actor: AdminUser,
    db: DbSession,
    limit: Annotated[int, Query(ge=1, le=100)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ServiceListOut:
    items, total = catalog.admin_list_services(db, actor, limit, offset)
    return ServiceListOut(items=[ServiceOut.model_validate(s) for s in items], total=total)


@router.get("/admin/providers/{provider_id}/services", response_model=list[ServiceOut])
def get_provider_services(provider_id: uuid.UUID, actor: AdminUser, db: DbSession) -> list[Service]:
    return catalog.get_provider_services(db, actor, provider_id)


@router.put("/admin/providers/{provider_id}/services", response_model=list[ServiceOut])
def set_provider_services(
    provider_id: uuid.UUID, data: ProviderServicesIn, actor: AdminUser, db: DbSession
) -> list[Service]:
    return catalog.set_provider_services(db, actor, provider_id, data.service_ids)


@router.get("/providers", response_model=list[ProviderOut])
def list_providers(db: DbSession, service_id: uuid.UUID | None = None) -> list[User]:
    return catalog.list_providers(db, service_id)


@router.get("/providers/{provider_id}/slots", response_model=list[datetime])
def provider_slots(
    provider_id: uuid.UUID,
    service_id: uuid.UUID,
    date_from: date,
    date_to: date,
    db: DbSession,
) -> list[datetime]:
    return catalog.provider_slots(db, provider_id, service_id, date_from, date_to)
