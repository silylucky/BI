from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.auth.models import AuthRole
from app.dashboard.service import get_dashboard, DashboardError
from app.reports.catalog import service as catalog_service
from app.reports.catalog.errors import ReportCatalogError
from app.views.schemas import ViewError
from app.views import role_defaults_repo

_USER_ROLE_DEFAULT_SCOPE: dict[str, str] = {}


def set_user_role_default_scope(user_id: str, role_prefix: str) -> None:
    _USER_ROLE_DEFAULT_SCOPE[user_id] = role_prefix


def _resolve_role_storage_key(db: Session | None, role_id: str) -> str:
    """Normalize role id/code to canonical UUID string for persistence."""
    try:
        return str(uuid.UUID(role_id))
    except ValueError:
        pass
    if db is None:
        return role_id
    row = db.query(AuthRole).filter(AuthRole.code == role_id).first()
    if row is None:
        row = db.query(AuthRole).filter(AuthRole.id == role_id).first()
    if row is not None:
        return str(row.id)
    return role_id


def _normalize_role_key(role_id: str) -> str:
    return _resolve_role_storage_key(None, role_id)


def _assert_admin(actor: UserContext) -> None:
    if "admin" not in actor.roles:
        raise ViewError("VIEW_DEFAULT_FORBIDDEN", "Admin role required", 403)


def _assert_read_scope(actor: UserContext, role_id: str) -> None:
    if "enterprise" not in set(actor.roles):
        return
    prefix = _USER_ROLE_DEFAULT_SCOPE.get(actor.id, "role-")
    if not role_id.startswith(prefix):
        raise ViewError("VIEW_DEFAULT_FORBIDDEN", "enterprise user out of role default scope", 403)


def _load_role_defaults(db: Session | None, role_key: str) -> dict[str, Any] | None:
    if db is None:
        return None
    canonical = _resolve_role_storage_key(db, role_key)
    stored = role_defaults_repo.get_role_defaults(db, canonical)
    if stored is not None:
        return stored
    if canonical != role_key:
        return role_defaults_repo.get_role_defaults(db, role_key)
    return None


def _detect_inherit_cycle(db: Session | None, role_id: str, inherit_from: str | None) -> None:
    if not inherit_from:
        return
    seen = {role_id}
    current = inherit_from
    while current:
        if current in seen:
            raise ViewError(
                "VIEW_DEFAULT_ROLE_CYCLE",
                "inheritFromRoleId creates a cycle",
                422,
                [{"field": "inheritFromRoleId", "message": "cycle detected"}],
            )
        seen.add(current)
        stored = _load_role_defaults(db, current)
        current = (stored or {}).get("inheritFromRoleId")


def _validate_refs(db: Session, payload: dict[str, Any]) -> None:
    dash_id = payload.get("dashboardId") or payload.get("dashboard_id")
    report_id = payload.get("reportTemplateNodeId") or payload.get("report_template_node_id")
    if dash_id is None and report_id is None:
        raise ViewError("VIEW_DEFAULT_EMPTY", "At least one default reference required", 422)

    if dash_id is not None:
        try:
            get_dashboard(db, uuid.UUID(str(dash_id)))
        except DashboardError:
            raise ViewError("VIEW_DEFAULT_DASHBOARD_NOT_FOUND", "Dashboard not found", 404) from None

    if report_id is not None:
        try:
            node = catalog_service.get_node(uuid.UUID(str(report_id)))
        except ReportCatalogError:
            raise ViewError("VIEW_DEFAULT_REPORT_NOT_FOUND", "Report template not found", 404) from None
        if node.node_type != "template":
            raise ViewError("VIEW_DEFAULT_REPORT_NOT_FOUND", "Report template not found", 404)


def get_defaults(role_id: str, actor: UserContext | None = None, db: Session | None = None) -> dict[str, Any]:
    if actor is not None:
        _assert_read_scope(actor, role_id)
    stored = _load_role_defaults(db, role_id)
    if stored is None:
        return {"dashboardId": None, "reportTemplateNodeId": None, "maxWidgetCount": 24}
    return {
        "dashboardId": stored.get("dashboardId"),
        "reportTemplateNodeId": stored.get("reportTemplateNodeId"),
        "maxWidgetCount": stored.get("maxWidgetCount", 24),
        "inheritFromRoleId": stored.get("inheritFromRoleId"),
    }


_MIN_WIDGETS = 1
_MAX_WIDGETS = 64


def _assert_widget_bounds(max_widgets: int) -> None:
    if max_widgets < _MIN_WIDGETS or max_widgets > _MAX_WIDGETS:
        raise ViewError(
            "VIEW_DEFAULT_OUT_OF_BOUNDS",
            f"maxWidgetCount must be between {_MIN_WIDGETS} and {_MAX_WIDGETS}",
            422,
            [{"field": "maxWidgetCount", "message": "out of bounds"}],
        )


def put_defaults(db: Session, role_id: str, payload: dict[str, Any], actor: UserContext) -> dict[str, Any]:
    _assert_admin(actor)
    max_widgets = int(payload.get("maxWidgetCount", 24))
    _assert_widget_bounds(max_widgets)
    inherit = payload.get("inheritFromRoleId")
    key = _resolve_role_storage_key(db, role_id)
    _detect_inherit_cycle(db, key, inherit)
    body = {
        "dashboardId": payload.get("dashboardId"),
        "reportTemplateNodeId": payload.get("reportTemplateNodeId"),
        "maxWidgetCount": max_widgets,
        "inheritFromRoleId": inherit,
    }
    _validate_refs(db, body)
    saved = role_defaults_repo.set_role_defaults(db, key, body)
    return saved


def _resolve_role_chain(
    db: Session | None,
    role_key: str,
    *,
    depth: int = 0,
    visited: set[str] | None = None,
) -> dict[str, Any] | None:
    if depth > 8:
        return None
    if visited is None:
        visited = set()
    if role_key in visited:
        return None
    visited.add(role_key)
    stored = _load_role_defaults(db, role_key)
    if stored is None:
        return None
    if stored.get("dashboardId") or stored.get("reportTemplateNodeId"):
        return stored
    inherit = stored.get("inheritFromRoleId")
    if inherit:
        return _resolve_role_chain(db, inherit, depth=depth + 1, visited=visited)
    return stored


def resolve_inherited_defaults(db: Session | None, role_codes: list[str]) -> dict[str, Any]:
    if db is None:
        return {"dashboardId": None, "reportTemplateNodeId": None, "maxWidgetCount": 24}
    for code in role_codes:
        key = _resolve_role_storage_key(db, code)
        resolved = _resolve_role_chain(db, key)
        if resolved is not None:
            return {
                "dashboardId": resolved.get("dashboardId"),
                "reportTemplateNodeId": resolved.get("reportTemplateNodeId"),
                "maxWidgetCount": resolved.get("maxWidgetCount", 24),
            }
    return {"dashboardId": None, "reportTemplateNodeId": None, "maxWidgetCount": 24}


def resolve_defaults_for_roles(role_codes: list[str], db: Session | None = None) -> dict[str, Any]:
    return resolve_inherited_defaults(db, role_codes)
