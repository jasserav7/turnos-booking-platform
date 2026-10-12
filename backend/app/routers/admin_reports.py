from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Response

from app.core.deps import DbSession, require_roles
from app.models import User, UserRole
from app.services import reports

router = APIRouter(prefix="/admin/reports", tags=["admin"])

ReportFormat = Literal["csv", "xlsx", "pdf"]

RENDERERS = {
    "csv": (reports.render_csv, "text/csv; charset=utf-8"),
    "xlsx": (
        reports.render_xlsx,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ),
    "pdf": (reports.render_pdf, "application/pdf"),
}


@router.get("")
def download_report(
    actor: Annotated[User, Depends(require_roles(UserRole.admin))],
    db: DbSession,
    format: ReportFormat = "csv",  # noqa: A002 - public query parameter name
    date_from: Annotated[date | None, Query()] = None,
    date_to: Annotated[date | None, Query()] = None,
) -> Response:
    report = reports.collect_report(db, actor, date_from, date_to)
    render, media_type = RENDERERS[format]
    filename = f"reporte-reservas_{report.date_from}_{report.date_to}.{format}"
    return Response(
        content=render(report),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
