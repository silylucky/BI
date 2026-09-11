from __future__ import annotations

from typing import Any

from app.dashboard.surface_kind import read_surface_kind_from_layout


def extract_preview_summary(layout_json: dict[str, Any] | None) -> dict[str, Any]:
    """Strip chart/sql payloads; keep geometry for list wireframe thumbnails."""
    if not layout_json:
        return {"version": 1, "widgets": [], "styleConfig": {}}

    try:
        version = int(layout_json.get("version") or 1)
    except (TypeError, ValueError):
        version = 1
    raw_widgets = layout_json.get("widgets") or []
    style = layout_json.get("styleConfig") or layout_json.get("style_config") or {}

    slim_widgets: list[dict[str, Any]] = []
    for widget in raw_widgets[:64]:
        if not isinstance(widget, dict):
            continue
        entry: dict[str, Any] = {
            "id": str(widget.get("id", "")),
            "order": int(widget.get("order") or 0),
        }
        widget_type = widget.get("type")
        if widget_type:
            entry["type"] = str(widget_type)
        title = widget.get("title")
        if isinstance(title, str) and title.strip():
            entry["title"] = title.strip()[:80]
        chart_cfg = widget.get("chartConfig") or widget.get("chart_config")
        if isinstance(chart_cfg, dict):
            chart_type = chart_cfg.get("chartType") or chart_cfg.get("chart_type")
            if chart_type:
                entry["chartType"] = str(chart_type)
        if version == 2:
            for key in ("x", "y", "width", "height"):
                if key in widget:
                    entry[key] = widget[key]
        else:
            col = widget.get("colSpan") if widget.get("colSpan") is not None else widget.get("col_span")
            if col is not None:
                entry["colSpan"] = col
            row = widget.get("rowSpan") if widget.get("rowSpan") is not None else widget.get("row_span")
            if row is not None:
                entry["rowSpan"] = row
        slim_widgets.append(entry)

    summary: dict[str, Any] = {"version": version, "widgets": slim_widgets}
    if version == 2:
        canvas = layout_json.get("canvas") or {"width": 1440, "height": 900}
        summary["canvas"] = canvas
    surface = style.get("surfaceKind") or style.get("surface_kind")
    if surface:
        summary["styleConfig"] = {"surfaceKind": surface}
    elif read_surface_kind_from_layout(layout_json) == "data-screen":
        summary["styleConfig"] = {"surfaceKind": "data-screen"}
    return summary


def sync_surface_kind_column(layout_json: dict[str, Any] | None) -> str:
    kind = read_surface_kind_from_layout(layout_json)
    return kind
