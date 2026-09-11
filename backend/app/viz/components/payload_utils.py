from __future__ import annotations

from typing import Any, Literal

from app.viz.components.errors import VizComponentError

WidgetType = Literal["chart", "filter", "text", "media", "customViz"]
SurfaceKind = Literal["dashboard", "data-screen"]

_PAYLOAD_KEYS: dict[str, str] = {
    "chart": "chartConfig",
    "filter": "filterConfig",
    "text": "textConfig",
    "media": "mediaConfig",
    "customViz": "customVizConfig",
}


def extract_payload_from_widget(widget: dict[str, Any]) -> dict[str, Any]:
    widget_type = widget.get("type")
    if widget_type not in _PAYLOAD_KEYS:
        raise VizComponentError(
            "VIZ_COMPONENT_UNSUPPORTED_WIDGET",
            f"Widget type {widget_type!r} cannot be published to component library",
            422,
        )
    key = _PAYLOAD_KEYS[widget_type]
    payload_value = widget.get(key)
    if payload_value is None:
        raise VizComponentError(
            "VIZ_COMPONENT_INVALID_PAYLOAD",
            f"Widget missing {key}",
            422,
        )
    return {key: payload_value}


def validate_payload_for_widget_type(widget_type: str, payload: dict[str, Any]) -> None:
    if widget_type not in _PAYLOAD_KEYS:
        raise VizComponentError("VIZ_COMPONENT_INVALID_TYPE", f"Invalid widgetType {widget_type!r}", 422)
    key = _PAYLOAD_KEYS[widget_type]
    if key not in payload or payload[key] is None:
        raise VizComponentError(
            "VIZ_COMPONENT_INVALID_PAYLOAD",
            f"payloadJson must include {key}",
            422,
        )
    extra_keys = set(payload.keys()) - {key}
    if extra_keys:
        raise VizComponentError(
            "VIZ_COMPONENT_INVALID_PAYLOAD",
            f"payloadJson has unexpected keys: {sorted(extra_keys)}",
            422,
        )


def normalize_surface_kinds(
    surface_kinds: list[str] | None,
    fallback: SurfaceKind = "dashboard",
) -> list[str]:
    if not surface_kinds:
        return [fallback]
    allowed = {"dashboard", "data-screen"}
    normalized = [k for k in surface_kinds if k in allowed]
    if not normalized:
        return [fallback]
    return sorted(set(normalized))
