from __future__ import annotations

import uuid as _uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response
from fastapi.responses import JSONResponse

from app.auth.deps import UserContext, require_permission
from app.core.http.download import content_disposition_attachment

PERM_READ = "report:read"
PERM_MANAGE = "report:manage"
from app.integration import reports_export as rex
from app.integration.errors import IntegrationError

router = APIRouter(prefix="/reports", tags=["integration", "IF-03"])


def _err_detail(exc: IntegrationError) -> dict | None:
    if exc.fields:
        return {"fields": exc.fields}
    if exc.trace_id:
        return {"traceId": exc.trace_id}
    return None


def _err(exc: IntegrationError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": _err_detail(exc)},
    )


@router.get("/export", response_model=rex.ReportExportOut)
def get_report_export(
    response: Response,
    actor: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    template_id: str = Query(alias="templateId"),
    format: str = Query(alias="format"),
    from_ts: datetime | None = Query(default=None, alias="from"),
    to_ts: datetime | None = Query(default=None, alias="to"),
):
    try:
        out = rex.create_export_request(
            actor,
            template_id_raw=template_id,
            fmt=format,
            from_ts=from_ts,
            to_ts=to_ts,
        )
        response.headers["X-RateLimit-Limit"] = "60"
        response.headers["X-RateLimit-Remaining"] = "59"
        return out
    except IntegrationError as exc:
        return _err(exc)


@router.get("/export/{export_id}", response_model=rex.ReportExportOut)
def get_export_status_route(
    export_id: _uuid.UUID,
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
):
    try:
        return rex.get_export_status(export_id)
    except IntegrationError as exc:
        return _err(exc)


@router.get("/export/{export_id}/download")
def download_export(
    export_id: _uuid.UUID,
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
):
    try:
        data, content_type, filename = rex.get_export_file(export_id)
        return Response(
            content=data,
            media_type=content_type,
            headers={"Content-Disposition": content_disposition_attachment(filename)},
        )
    except IntegrationError as exc:
        return _err(exc)
