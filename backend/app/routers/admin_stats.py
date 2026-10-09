from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.deps import DbSession, require_roles
from app.models import User, UserRole
from app.schemas.booking import StatsOut
from app.services import stats

router = APIRouter(prefix="/admin/stats", tags=["admin"])


@router.get("", response_model=StatsOut)
def get_stats(
    actor: Annotated[User, Depends(require_roles(UserRole.admin))], db: DbSession
) -> StatsOut:
    return stats.get_stats(db, actor)
