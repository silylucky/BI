from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.views.models import ViewRoleDefault


def _row_to_dict(row: ViewRoleDefault) -> dict[str, Any]:
    return {
        "dashboardId": str(row.dashboard_id) if row.dashboard_id else None,
        "reportTemplateNodeId": str(row.report_template_node_id) if row.report_template_node_id else None,
        "maxWidgetCount": row.max_widget_count,
        "inheritFromRoleId": row.inherit_from_role_id,
    }


def get_role_defaults(db: Session, role_key: str) -> dict[str, Any] | None:
    row = db.get(ViewRoleDefault, role_key)
    if row is None:
        return None
    return _row_to_dict(row)


def set_role_defaults(db: Session, role_key: str, payload: dict[str, Any]) -> dict[str, Any]:
    dash_raw = payload.get("dashboardId") or payload.get("dashboard_id")
    report_raw = payload.get("reportTemplateNodeId") or payload.get("report_template_node_id")
    row = db.get(ViewRoleDefault, role_key)
    if row is None:
        row = ViewRoleDefault(role_key=role_key)
        db.add(row)
    row.dashboard_id = uuid.UUID(str(dash_raw)) if dash_raw else None
    row.report_template_node_id = uuid.UUID(str(report_raw)) if report_raw else None
    row.max_widget_count = int(payload.get("maxWidgetCount", payload.get("max_widget_count", 24)))
    row.inherit_from_role_id = payload.get("inheritFromRoleId") or payload.get("inherit_from_role_id")
    db.commit()
    db.refresh(row)
    return _row_to_dict(row)


def clear_role_defaults(db: Session) -> None:
    db.query(ViewRoleDefault).delete()
    db.commit()
