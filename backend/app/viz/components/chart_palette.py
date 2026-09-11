from __future__ import annotations

from typing import Any

from app.viz.registry import ChartTypeNotRegistered, get_spec


def chart_type_from_payload(payload: dict[str, Any] | None) -> str | None:
    if not payload:
        return None
    chart_cfg = payload.get("chartConfig") or payload.get("chart_config")
    if not isinstance(chart_cfg, dict):
        return None
    chart_type = chart_cfg.get("chartType") or chart_cfg.get("chart_type")
    return chart_type if isinstance(chart_type, str) and chart_type else None


def chart_palette_category_from_payload(payload: dict[str, Any] | None) -> str | None:
    chart_type = chart_type_from_payload(payload)
    if not chart_type:
        return None
    try:
        spec = get_spec(chart_type)
    except ChartTypeNotRegistered:
        return "compare"
    return spec.palette_category or spec.category or "compare"
