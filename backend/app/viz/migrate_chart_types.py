"""存量 chartType / styleVariant → DE 独立 type（与 fe/src/lib/migrateChartTypes.ts 对齐）。"""

from __future__ import annotations

from typing import Any

from app.dashboard.templates.legacy_sql_field_aliases import remap_legacy_sql_fields_in_chart_config

_TYPE_MIGRATIONS: dict[str, str] = {
    "table": "table-info",
    "combo": "chart-mix",
    "heatmap": "t-heatmap",
    "wordCloud": "word-cloud",
}

_STYLE_VARIANT_RULES: tuple[tuple[str, str, str], ...] = (
    ("bar", "stacked", "bar-stack"),
    ("bar", "grouped", "bar-group"),
    ("bar", "horizontal", "bar-horizontal"),
    ("pie", "donut", "pie-donut"),
    ("pie", "rose", "pie-rose"),
    ("line", "area", "area"),
    ("line", "stacked", "area-stack"),
)


def migrate_chart_config(data: Any) -> Any:
    if not isinstance(data, dict):
        return data
    out = dict(data)
    chart_type = out.get("chartType")
    if not isinstance(chart_type, str):
        return out

    direct = _TYPE_MIGRATIONS.get(chart_type)
    if direct:
        out["chartType"] = direct
        out["styleVariant"] = "default"
        chart_type = direct

    style_variant = out.get("styleVariant") or "default"
    if isinstance(style_variant, str):
        for src_type, src_variant, next_type in _STYLE_VARIANT_RULES:
            if chart_type == src_type and style_variant == src_variant:
                out["chartType"] = next_type
                out["styleVariant"] = "default"
                break

    return remap_legacy_sql_fields_in_chart_config(out)


def migrate_layout_chart_configs(layout: Any) -> Any:
    if not layout or not isinstance(layout, dict):
        return layout
    widgets = layout.get("widgets")
    if not isinstance(widgets, list):
        return layout
    next_layout = dict(layout)
    next_widgets: list[Any] = []
    for widget in widgets:
        if not isinstance(widget, dict):
            next_widgets.append(widget)
            continue
        w = dict(widget)
        if w.get("type") == "chart" and isinstance(w.get("chartConfig"), dict):
            w["chartConfig"] = migrate_chart_config(w["chartConfig"])
        next_widgets.append(w)
    next_layout["widgets"] = next_widgets
    return next_layout
