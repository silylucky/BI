from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.auth.deps import UserContext, require_permission
from app.auth.models import get_meta_session
from app.dashboard.demo_package.status import build_demo_package_status

PERM_READ = "dashboard:read"

router = APIRouter(prefix="/demo-package", tags=["demo-package"])


@router.get("/status")
def get_demo_package_status(
    _actor: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    refresh: bool = Query(default=False, alias="refresh"),
):
    session = get_meta_session()
    try:
        return build_demo_package_status(session, refresh_schema=refresh).as_dict()
    finally:
        session.close()
