from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.datasources.models import get_meta_engine
from app.dashboard import service as dash_service
from app.reports.catalog.acl import _NODE_OWNERS
from app.reports.scheduler.errors import ScheduleError


def _is_catalog_owner(actor: UserContext, catalog_node_id: uuid.UUID | None) -> bool:
    if catalog_node_id is None:
        return False
    return _NODE_OWNERS.get(catalog_node_id) == actor.id


def _is_dashboard_owner(actor: UserContext, source_id: uuid.UUID | None) -> bool:
    if source_id is None:
        return False
    try:
        with Session(bind=get_meta_engine()) as db:
            row = dash_service.get_dashboard(db, source_id)
            if row.created_by is None:
                return False
            return str(row.created_by) == actor.id
    except dash_service.DashboardError:
        return False


def _has_schedule_manage(actor: UserContext, row: dict) -> bool:
    if actor.is_root:
        return True
    if "report:manage" in actor.permissions:
        return True
    if row.get("owner_id") == actor.id:
        return True
    source_type = row.get("source_type", "template")
    source_id = row.get("source_id") or row.get("catalog_node_id")
    if source_type in {"dashboard", "data_screen"} and source_id is not None:
        if "dashboard:schedule" in actor.permissions and _is_dashboard_owner(actor, source_id):
            return True
        if row.get("owner_id") == actor.id:
            return True
    if _is_catalog_owner(actor, row.get("catalog_node_id")):
        return True
    if "editor" in actor.roles:
        return True
    return False


def assert_schedule_read(actor: UserContext, row: dict) -> None:
    if actor.is_root:
        return
    if "report:read" in actor.permissions or "report:manage" in actor.permissions:
        if _is_catalog_owner(actor, row.get("catalog_node_id")):
            return
        if row.get("owner_id") == actor.id:
            return
        source_type = row.get("source_type", "template")
        source_id = row.get("source_id") or row.get("catalog_node_id")
        if source_type in {"dashboard", "data_screen"} and _is_dashboard_owner(actor, source_id):
            return
    if row.get("owner_id") == actor.id:
        return
    if _is_catalog_owner(actor, row.get("catalog_node_id")):
        return
    source_type = row.get("source_type", "template")
    source_id = row.get("source_id") or row.get("catalog_node_id")
    if source_type in {"dashboard", "data_screen"} and _is_dashboard_owner(actor, source_id):
        return
    raise ScheduleError("RPT_SCHEDULE_FORBIDDEN", "Schedule read denied", 403)


def assert_schedule_write(actor: UserContext, row: dict, action: str) -> None:
    if "viewer" in actor.roles and not actor.is_root:
        raise ScheduleError("RPT_SCHEDULE_FORBIDDEN", f"Viewer cannot {action}", 403)
    if _has_schedule_manage(actor, row):
        return
    raise ScheduleError("RPT_SCHEDULE_FORBIDDEN", f"Schedule {action} denied", 403)
