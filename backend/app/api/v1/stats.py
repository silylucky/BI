from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse

from app.auth.deps import UserContext, require_permission

PERM_READ = "dashboard:read"
from app.governance.catalog.cat02.errors import Cat02Error
from app.governance.catalog.cat02 import query as cat02_query

router = APIRouter(prefix="/stats", tags=["catalog", "IF-02"])


def _cat02_error(exc: Cat02Error) -> JSONResponse:
    detail = {"fields": exc.fields} if exc.fields else None
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": detail},
    )


@router.get("/aggregate", response_model=None)
def get_stats_aggregate(
    actor: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    template_key: str = Query(alias="templateKey"),
    group_by: str = Query(alias="groupBy"),
):
    try:
        return cat02_query.query_aggregate(template_key, group_by, actor)
    except Cat02Error as exc:
        return _cat02_error(exc)
