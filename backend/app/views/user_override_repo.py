from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.views.models import ViewUserOverride


def _row_to_dict(row: ViewUserOverride) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "name": row.name,
        "dashboardId": str(row.dashboard_id),
        "layout": row.layout_json,
        "classificationScope": row.classification_scope,
        "inheritedFromRole": row.inherited_from_role,
        "isDefault": row.is_default,
    }


def list_user_overrides(db: Session, user_id: str) -> list[dict[str, Any]]:
    rows = (
        db.query(ViewUserOverride)
        .filter(ViewUserOverride.user_id == user_id)
        .order_by(ViewUserOverride.updated_at.asc())
        .all()
    )
    return [_row_to_dict(row) for row in rows]


def add_user_override(db: Session, user_id: str, item: dict[str, Any]) -> dict[str, Any]:
    row = ViewUserOverride(
        id=uuid.UUID(str(item["id"])),
        user_id=user_id,
        name=item["name"],
        dashboard_id=uuid.UUID(str(item["dashboardId"])),
        layout_json=item.get("layout") or {},
        classification_scope=item.get("classificationScope"),
        inherited_from_role=bool(item.get("inheritedFromRole")),
        is_default=bool(item.get("isDefault")),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _row_to_dict(row)


def update_user_override(
    db: Session,
    user_id: str,
    view_id: str,
    patch: dict[str, Any],
) -> dict[str, Any]:
    row = db.get(ViewUserOverride, uuid.UUID(str(view_id)))
    if row is None or row.user_id != user_id:
        raise KeyError(view_id)
    if "name" in patch:
        row.name = patch["name"]
    if "dashboardId" in patch:
        row.dashboard_id = uuid.UUID(str(patch["dashboardId"]))
    if "layout" in patch:
        row.layout_json = patch["layout"] or {}
    if "classificationScope" in patch:
        row.classification_scope = patch.get("classificationScope")
    if "inheritedFromRole" in patch:
        row.inherited_from_role = bool(patch["inheritedFromRole"])
    if "isDefault" in patch:
        row.is_default = bool(patch["isDefault"])
    db.commit()
    db.refresh(row)
    return _row_to_dict(row)


def remove_user_override(db: Session, user_id: str, view_id: str) -> None:
    row = db.get(ViewUserOverride, uuid.UUID(str(view_id)))
    if row is None or row.user_id != user_id:
        raise KeyError(view_id)
    db.delete(row)
    db.commit()


def apply_default_flag(db: Session, user_id: str, view_id: str | None) -> None:
    rows = db.query(ViewUserOverride).filter(ViewUserOverride.user_id == user_id).all()
    target = uuid.UUID(str(view_id)) if view_id else None
    for row in rows:
        row.is_default = target is not None and row.id == target
    db.commit()


def clear_user_overrides(db: Session) -> None:
    db.query(ViewUserOverride).delete()
    db.commit()
