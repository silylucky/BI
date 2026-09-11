from __future__ import annotations

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse

from app.auth.deps import UserContext, require_permission

PERM_READ = "governance:read"
from app.governance.catalog.cat07.errors import Cat07Error
from app.governance.catalog.cat07 import service as cat07_service

router = APIRouter(prefix="/workno", tags=["catalog", "IF-02"])


def _cat07_error(exc: Cat07Error) -> JSONResponse:
    detail = {"fields": exc.fields} if exc.fields else None
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": detail},
    )


@router.get("/behavior", response_model=None)
def get_workno_behavior(
    actor: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    workno: str | None = Query(default=None),
    from_date: date | None = Query(default=None, alias="fromDate"),
    to_date: date | None = Query(default=None, alias="toDate"),
    limit: int = Query(default=50, ge=1),
    offset: int = Query(default=0, ge=0),
):
    try:
        return cat07_service.query_behavior(workno, from_date, to_date, limit, offset, actor)
    except Cat07Error as exc:
        return _cat07_error(exc)
