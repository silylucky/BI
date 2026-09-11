from __future__ import annotations

from typing import Any, Literal

SurfaceKindFilter = Literal["dashboard", "data-screen"]


def layout_to_dict(layout_json: Any) -> dict[str, Any]:
    if layout_json is None:
        return {}
    if hasattr(layout_json, "model_dump"):
        return layout_json.model_dump(by_alias=True, mode="json")
    return layout_json if isinstance(layout_json, dict) else {}


def read_surface_kind_from_layout(layout_json: dict[str, Any] | Any | None) -> SurfaceKindFilter:
    layout_json = layout_to_dict(layout_json)
    style = layout_json.get("styleConfig") or layout_json.get("style_config") or {}
    if not isinstance(style, dict):
        return "dashboard"
    kind = style.get("surfaceKind") or style.get("surface_kind")
    return "data-screen" if kind == "data-screen" else "dashboard"


def matches_surface_filter(
    layout_json: dict[str, Any] | None,
    surface_kind: SurfaceKindFilter | None,
) -> bool:
    if surface_kind is None:
        return True
    actual = read_surface_kind_from_layout(layout_json)
    if surface_kind == "data-screen":
        return actual == "data-screen"
    return actual != "data-screen"
