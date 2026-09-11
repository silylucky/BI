from __future__ import annotations

from collections import defaultdict
from typing import TypedDict

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.dashboard.models import Dashboard


class ComponentReferenceRow(TypedDict):
    dashboard_id: str
    dashboard_name: str
    dashboard_surface_kind: str
    widget_id: str
    widget_title: str | None


def _collect_linked_component_ids(layout: dict) -> list[str]:
    ids: list[str] = []
    for widget in layout.get("widgets") or []:
        if not isinstance(widget, dict):
            continue
        ref = widget.get("componentRef")
        if not isinstance(ref, dict):
            continue
        component_id = ref.get("componentId")
        if component_id and not ref.get("detached"):
            ids.append(str(component_id))
    return ids


def _iter_linked_widgets(layout: dict, component_id: str) -> list[tuple[str, str | None]]:
    hits: list[tuple[str, str | None]] = []
    for widget in layout.get("widgets") or []:
        if not isinstance(widget, dict):
            continue
        ref = widget.get("componentRef")
        if not isinstance(ref, dict):
            continue
        if str(ref.get("componentId")) != component_id or ref.get("detached"):
            continue
        widget_id = widget.get("id")
        if not widget_id:
            continue
        title = widget.get("title")
        hits.append((str(widget_id), str(title) if title else None))
    return hits


def list_component_references(db: Session, component_id: str) -> list[ComponentReferenceRow]:
    rows: list[ComponentReferenceRow] = []
    dashboards = db.scalars(
        select(Dashboard).where(Dashboard.deleted_at.is_(None)),
    ).all()
    for dashboard in dashboards:
        layout = dashboard.layout_json
        if not isinstance(layout, dict):
            continue
        for widget_id, widget_title in _iter_linked_widgets(layout, component_id):
            rows.append(
                {
                    "dashboard_id": str(dashboard.id),
                    "dashboard_name": dashboard.name,
                    "dashboard_surface_kind": dashboard.surface_kind,
                    "widget_id": widget_id,
                    "widget_title": widget_title,
                },
            )
    return rows


def count_component_references(db: Session) -> dict[str, int]:
    counts: dict[str, int] = defaultdict(int)
    layouts = db.scalars(
        select(Dashboard.layout_json).where(Dashboard.deleted_at.is_(None)),
    ).all()
    for layout in layouts:
        if not isinstance(layout, dict):
            continue
        for component_id in _collect_linked_component_ids(layout):
            counts[component_id] += 1
    return counts
