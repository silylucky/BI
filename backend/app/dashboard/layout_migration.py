from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from app.dashboard.schemas import DashboardCanvas, DashboardLayout

PIXEL_COLUMN_WIDTH = 120
PIXEL_ROW_HEIGHT = 32
PIXEL_ROW_MARGIN = 12
_V1_WIDGET_FIELDS = frozenset(
    {"colSpan", "rowSpan", "gridX", "gridY", "col_span", "row_span", "grid_x", "grid_y"}
)


def migrate_v1_to_v2(
    layout: DashboardLayout | dict[str, Any],
    canvas: DashboardCanvas | dict[str, int] | None = None,
) -> DashboardLayout:
    """Convert a v1 grid layout to deterministic persisted pixel coordinates."""
    from app.dashboard.schemas import DashboardCanvas, DashboardLayout

    source = layout if isinstance(layout, DashboardLayout) else DashboardLayout.model_validate(layout)
    if source.version != 1:
        raise ValueError("migrate_v1_to_v2 only accepts version 1 layouts")
    target_canvas = (
        canvas
        if isinstance(canvas, DashboardCanvas)
        else DashboardCanvas.model_validate(canvas or {})
    )
    widgets: list[dict[str, Any]] = []
    lowest_edge = target_canvas.height
    for widget in source.widgets:
        raw = widget.model_dump(by_alias=True, mode="json")
        col_span = widget.col_span or 6
        row_span = widget.row_span or 1
        grid_x = widget.grid_x or 0
        grid_y = widget.grid_y if widget.grid_y is not None else widget.order
        pixel_height = row_span * PIXEL_ROW_HEIGHT + (row_span - 1) * PIXEL_ROW_MARGIN
        raw.update(
            {
                "x": grid_x * PIXEL_COLUMN_WIDTH,
                "y": grid_y * (PIXEL_ROW_HEIGHT + PIXEL_ROW_MARGIN),
                "width": col_span * PIXEL_COLUMN_WIDTH,
                "height": pixel_height,
            }
        )
        for field in _V1_WIDGET_FIELDS:
            raw.pop(field, None)
        widgets.append(raw)
        lowest_edge = max(lowest_edge, raw["y"] + raw["height"])
    migrated: dict[str, Any] = {
        "version": 2,
        "canvas": {"width": target_canvas.width, "height": lowest_edge},
        "widgets": widgets,
        "globalFilters": source.global_filters,
    }
    if source.style_config is not None:
        migrated["styleConfig"] = source.style_config.model_dump(by_alias=True, exclude_none=True)
    return DashboardLayout.model_validate(migrated)
