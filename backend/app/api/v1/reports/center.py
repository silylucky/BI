from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse, Response

from app.auth.deps import UserContext, require_permission
from app.core.config import get_settings
from app.reports.catalog.errors import ReportCatalogError
from app.reports.contract import ReportCenterPreferencesOut
from app.reports.scheduler.errors import ScheduleError
from app.reports import service as report_service
from app.reports.scheduler.schemas import ScheduleUpdate

PERM_READ = "report:read"
PERM_MANAGE = "report:manage"

router = APIRouter(prefix="/center", tags=["reports-center"])


@router.post("/seed-demo", response_model=None)
def seed_demo_reports(
    user: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
):
    if get_settings().vitalspan_env == "production":
        return JSONResponse(
            status_code=403,
            content={
                "code": "RPT_SEED_DEMO_FORBIDDEN",
                "message": "生产环境不支持加载示例报表，请通过模板管理新建或导入正式模板。",
                "detail": None,
            },
        )
    from app.auth.models import get_meta_session
    from app.reports.dev_seed import seed_dev_reports

    session = get_meta_session()
    try:
        counts = seed_dev_reports(session, actor=user)
    finally:
        session.close()
    if counts.get("dataSourceId") is None:
        return {
            "code": "partial",
            "message": "示例报表部分加载：未找到演示数据源，标准分析包已就绪；请配置数据源后重试。",
            "detail": counts,
        }
    return {"code": "ok", "message": "示例报表已就绪", "detail": counts}


@router.get("/preferences", response_model=None)
def get_center_preferences(
    user: Annotated[UserContext, Depends(require_permission(PERM_READ))],
):
    return report_service.get_center_preferences(user)


@router.put("/preferences", response_model=None)
def update_center_preferences(
    payload: ReportCenterPreferencesOut,
    user: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
):
    from app.reports import center_prefs

    return center_prefs.set_favorites(user, payload.favorites).model_dump(by_alias=True)


@router.post("/recent", status_code=204, response_model=None)
def record_recent_view(
    payload: dict,
    user: Annotated[UserContext, Depends(require_permission(PERM_READ))],
):
    from app.reports import center_prefs

    center_prefs.record_recent_view(
        user,
        resource_type=payload.get("resourceType", ""),
        resource_id=payload.get("resourceId", ""),
        resource_label=payload.get("resourceLabel"),
    )
    return None
