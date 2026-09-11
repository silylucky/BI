from __future__ import annotations

from app.viz.builtin._helpers import CARTESIAN, antv

TREND_SPECS = (
    antv(
        "line",
        "基础折线图",
        "trend",
        style_variants=("default", "smooth"),
        deprecated=False,
    ),
    antv("area", "面积图", "trend"),
    antv("area-stack", "堆叠折线图", "trend"),
    antv(
        "timeline",
        "时间轴（已弃用）",
        "trend",
        deprecated=True,
        migrates_to="line",
        field_rule=CARTESIAN,
    ),
)
