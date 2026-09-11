"""仪表板标准 12 列栅格占位（对标 DataEase 模板库构图，无空洞行）。"""

from __future__ import annotations

from typing import Any

# 行高单位：与 fe GRID_ROW_HEIGHT=32 对齐
KPI_ROW = 2
METRIC_ROW = 3
CHART_ROW = 6
CHART_ROW_SM = 3


def grid_place(
    widget: dict[str, Any],
    *,
    x: int,
    y: int,
    w: int,
    h: int,
    order: int,
) -> dict[str, Any]:
    return {
        **widget,
        "gridX": x,
        "gridY": y,
        "colSpan": w,
        "rowSpan": h,
        "order": order,
    }
