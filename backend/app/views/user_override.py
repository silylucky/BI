from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.dashboard.service import DashboardError, get_dashboard
from app.views import user_override_repo
from app.views.role_template import resolve_defaults_for_roles
from app.views.schemas import ViewError
from app.views.validate import validate_dashboard_view

_CLASSIFICATION_ALLOWLIST = frozenset({"CAT-01", "CAT-02", "CAT-03"})
_LEGACY_DEFAULT_VIEW_NAME = "默认"


def _normalize_item(item: dict[str, Any]) -> dict[str, Any]:
    out = dict(item)
    out["isDefault"] = bool(item.get("isDefault"))
    return out


def _migrate_legacy_defaults(db: Session, user_id: str) -> None:
    bucket = user_override_repo.list_user_overrides(db, user_id)
    if not bucket:
        return
    if any(bool(item.get("isDefault")) for item in bucket):
        return
    legacy = next((item for item in bucket if item.get("name") == _LEGACY_DEFAULT_VIEW_NAME), None)
    if legacy is not None:
        user_override_repo.apply_default_flag(db, user_id, legacy.get("id"))
        return
    if len(bucket) == 1:
        user_override_repo.apply_default_flag(db, user_id, bucket[0].get("id"))


def _apply_default_flag(db: Session, user_id: str, view_id: str | None) -> None:
    user_override_repo.apply_default_flag(db, user_id, view_id)


def _read_is_default(payload: dict[str, Any]) -> bool | None:
    if "isDefault" in payload:
        return bool(payload["isDefault"])
    if "is_default" in payload:
        return bool(payload["is_default"])
    return None


def _widget_count(layout: dict[str, Any]) -> int:
    if "widgetCount" in layout:
        return int(layout["widgetCount"])
    return len(layout.get("widgets") or [])


def list_overrides(user_id: str, db: Session | None = None, role_codes: list[str] | None = None) -> dict[str, Any]:
    if db is None:
        raise ValueError("db session required")
    if role_codes is not None:
        from app.views.onboarding import apply_first_login_inherit

        apply_first_login_inherit(db, user_id, role_codes)
    _migrate_legacy_defaults(db, user_id)
    items = [_normalize_item(item) for item in user_override_repo.list_user_overrides(db, user_id)]
    return {"items": items}


def get_override(db: Session, user_id: str, view_id: str) -> dict[str, Any]:
    _migrate_legacy_defaults(db, user_id)
    for item in user_override_repo.list_user_overrides(db, user_id):
        if item.get("id") == view_id:
            return _normalize_item(item)
    raise ViewError("VIEW_OVERRIDE_NOT_FOUND", "View override not found", 404)


def create_override(db: Session, actor: UserContext, payload: dict[str, Any]) -> dict[str, Any]:
    name = payload.get("name")
    user_id = actor.id
    is_default = _read_is_default(payload)
    if not name and not user_override_repo.list_user_overrides(db, user_id):
        name = _LEGACY_DEFAULT_VIEW_NAME
        if is_default is None:
            is_default = True
    if not name:
        name = payload["name"]
    for existing in user_override_repo.list_user_overrides(db, user_id):
        if existing.get("name") == name:
            raise ViewError("VIEW_OVERRIDE_CONFLICT", "View name already exists", 409)

    scope = payload.get("classificationScope")
    if scope and scope not in _CLASSIFICATION_ALLOWLIST:
        raise ViewError(
            "VIEW_OVERRIDE_CLASSIFICATION_DENIED",
            "Classification scope not allowed",
            422,
        )

    try:
        get_dashboard(db, uuid.UUID(str(payload["dashboardId"])))
    except DashboardError:
        raise ViewError("VIEW_OVERRIDE_DASHBOARD_NOT_FOUND", "Dashboard not found", 404) from None

    bounds = resolve_defaults_for_roles(list(actor.roles), db)
    layout = payload.get("layout") or {}
    if _widget_count(layout) > int(bounds.get("maxWidgetCount", 24)):
        raise ViewError("VIEW_OVERRIDE_OUT_OF_BOUNDS", "Widget count exceeds role default", 422)

    view_payload = {
        "name": name,
        "dashboardId": str(payload["dashboardId"]),
        "layout": layout,
    }
    try:
        validate_dashboard_view(view_payload)
    except ViewError:
        raise

    view_id = str(uuid.uuid4())
    item = {
        "id": view_id,
        "name": name,
        "dashboardId": str(payload["dashboardId"]),
        "layout": layout,
        "classificationScope": scope,
        "isDefault": bool(is_default),
    }
    created = user_override_repo.add_user_override(db, user_id, item)
    if is_default:
        _apply_default_flag(db, user_id, view_id)
        created = get_override(db, user_id, view_id)
    return _normalize_item(created)


def _validate_override_payload(db: Session, actor: UserContext, payload: dict[str, Any], *, exclude_id: str | None = None) -> None:
    name = payload.get("name")
    if name:
        for existing in user_override_repo.list_user_overrides(db, actor.id):
            if existing.get("id") == exclude_id:
                continue
            if existing.get("name") == name:
                raise ViewError("VIEW_OVERRIDE_CONFLICT", "View name already exists", 409)

    scope = payload.get("classificationScope")
    if scope and scope not in _CLASSIFICATION_ALLOWLIST:
        raise ViewError(
            "VIEW_OVERRIDE_CLASSIFICATION_DENIED",
            "Classification scope not allowed",
            422,
        )

    dashboard_id = payload.get("dashboardId")
    if dashboard_id is not None:
        try:
            get_dashboard(db, uuid.UUID(str(dashboard_id)))
        except DashboardError:
            raise ViewError("VIEW_OVERRIDE_DASHBOARD_NOT_FOUND", "Dashboard not found", 404) from None

    bounds = resolve_defaults_for_roles(list(actor.roles), db)
    layout = payload.get("layout") or {}
    if _widget_count(layout) > int(bounds.get("maxWidgetCount", 24)):
        raise ViewError("VIEW_OVERRIDE_OUT_OF_BOUNDS", "Widget count exceeds role default", 422)


def update_override(db: Session, actor: UserContext, view_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    existing = get_override(db, actor.id, view_id)
    merged = {**existing, **payload, "id": view_id}
    _validate_override_payload(db, actor, merged, exclude_id=view_id)
    view_payload = {
        "name": merged["name"],
        "dashboardId": str(merged["dashboardId"]),
        "layout": merged.get("layout") or {},
    }
    try:
        validate_dashboard_view(view_payload)
    except ViewError:
        raise
    patch = {
        "name": merged["name"],
        "dashboardId": str(merged["dashboardId"]),
        "layout": merged.get("layout") or {},
    }
    if "classificationScope" in payload:
        patch["classificationScope"] = payload.get("classificationScope")
    is_default = _read_is_default(payload)
    if is_default is not None:
        patch["isDefault"] = is_default
        if is_default:
            _apply_default_flag(db, actor.id, view_id)
    try:
        updated = user_override_repo.update_user_override(db, actor.id, view_id, patch)
        return _normalize_item(updated)
    except KeyError:
        raise ViewError("VIEW_OVERRIDE_NOT_FOUND", "View override not found", 404) from None


def delete_override(db: Session, actor: UserContext, view_id: str) -> None:
    try:
        user_override_repo.remove_user_override(db, actor.id, view_id)
    except KeyError:
        raise ViewError("VIEW_OVERRIDE_NOT_FOUND", "View override not found", 404) from None
