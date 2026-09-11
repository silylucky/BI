"""官方组件全覆盖验收大屏布局（每种 chartType 一 widget）。"""

from __future__ import annotations

from typing import Any

from app.dashboard.templates.official_demo_sql import OFFICIAL_DEMO_CHART_QUERIES
from app.dashboard.templates.presets import _chart, _screen_style

_GALLERY_COLS = 6
_GALLERY_CELL_W = 300
_GALLERY_CELL_H = 160
_GALLERY_GAP_X = 12
_GALLERY_GAP_Y = 16
_GALLERY_PAD = 24


def _gallery_position(index: int) -> tuple[int, int, int, int]:
    col = index % _GALLERY_COLS
    row = index // _GALLERY_COLS
    x = _GALLERY_PAD + col * (_GALLERY_CELL_W + _GALLERY_GAP_X)
    y = _GALLERY_PAD + row * (_GALLERY_CELL_H + _GALLERY_GAP_Y)
    return x, y, _GALLERY_CELL_W, _GALLERY_CELL_H


def build_official_component_gallery_layout() -> dict[str, Any]:
    """遍历官方 SQL 注册表，为每种 chartType 生成一个 chart widget。"""
    chart_types = sorted(OFFICIAL_DEMO_CHART_QUERIES.keys())
    widgets: list[dict[str, Any]] = []
    for index, chart_type in enumerate(chart_types):
        query = OFFICIAL_DEMO_CHART_QUERIES[chart_type]
        x, y, width, height = _gallery_position(index)
        dims = [dict(d) for d in query.dimensions] if query.dimensions else None
        mets = [dict(m) for m in query.metrics] if query.metrics else None
        widgets.append(
            _chart(
                chart_type=chart_type,
                title=query.title,
                sql=query.sql,
                dimensions=dims,
                metrics=mets,
                x=x,
                y=y,
                width=width,
                height=height,
                order=index + 1,
            ),
        )
    rows = (len(chart_types) + _GALLERY_COLS - 1) // _GALLERY_COLS
    canvas_height = _GALLERY_PAD * 2 + rows * _GALLERY_CELL_H + max(0, rows - 1) * _GALLERY_GAP_Y
    return {
        "version": 2,
        "canvas": {"width": 1920, "height": max(canvas_height, 1080)},
        "widgets": widgets,
        "globalFilters": [],
        "styleConfig": _screen_style(decor="gradient-radial"),
    }
