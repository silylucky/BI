from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.ai_viz.schemas import AiVizArtifactReferenceOut, AiVizArtifactUnlinkDashboardOut
from app.dashboard.models import Dashboard


def artifact_id_in_widget(widget: dict[str, Any], artifact_id: uuid.UUID) -> str | None:
    cv = widget.get("customVizConfig") or widget.get("custom_viz_config")
    if not isinstance(cv, dict):
        return None
    ref = cv.get("artifactId") or cv.get("artifact_id")
    if ref is None or str(ref) != str(artifact_id):
        return None
    wid = widget.get("id")
    return str(wid) if wid is not None else ""


def scan_artifact_in_layouts(
    db: Session,
    artifact_id: uuid.UUID,
    *,
    remove: bool = False,
) -> tuple[list[AiVizArtifactReferenceOut], list[AiVizArtifactUnlinkDashboardOut]]:
    refs: list[AiVizArtifactReferenceOut] = []
    summaries: list[AiVizArtifactUnlinkDashboardOut] = []
    rows = db.scalars(select(Dashboard)).all()
    for row in rows:
        layout = row.layout_json if isinstance(row.layout_json, dict) else {}
        widgets = layout.get("widgets") or []
        if not isinstance(widgets, list):
            continue
        removed_ids: list[str] = []
        kept: list[Any] = []
        for widget in widgets:
            if not isinstance(widget, dict):
                if remove:
                    kept.append(widget)
                continue
            widget_id = artifact_id_in_widget(widget, artifact_id)
            if widget_id is not None:
                refs.append(
                    AiVizArtifactReferenceOut(
                        dashboardId=row.id,
                        dashboardName=row.name,
                        widgetId=widget_id,
                    )
                )
                if remove:
                    removed_ids.append(widget_id)
                    continue
            if remove:
                kept.append(widget)
        if remove and removed_ids:
            row.layout_json = {**layout, "widgets": kept}
            flag_modified(row, "layout_json")
            summaries.append(
                AiVizArtifactUnlinkDashboardOut(
                    dashboardId=row.id,
                    dashboardName=row.name,
                    removedWidgetIds=removed_ids,
                )
            )
    return refs, summaries


def find_artifact_references(db: Session, artifact_id: uuid.UUID) -> list[AiVizArtifactReferenceOut]:
    refs, _ = scan_artifact_in_layouts(db, artifact_id, remove=False)
    return refs


def unlink_artifact_from_layouts(
    db: Session,
    artifact_id: uuid.UUID,
) -> list[AiVizArtifactUnlinkDashboardOut]:
    _, summaries = scan_artifact_in_layouts(db, artifact_id, remove=True)
    return summaries
