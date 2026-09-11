from __future__ import annotations

from app.viz.specs import FieldRule

from app.viz.builtin._helpers import CARTESIAN, antv

_COMPARE = CARTESIAN
_PROGRESS = FieldRule(1, 1, 2, 2)
_BULLET = FieldRule(1, 1, 2, 3)
_BI = FieldRule(1, 1, 2, 2)
_BAR_RANGE = FieldRule(1, 1, 2, 2)
_STOCK = FieldRule(1, 1, 4, 4)

COMPARE_SPECS = (
    antv(
        "bar",
        "基础柱状图",
        "compare",
        style_variants=("default",),
        deprecated=False,
    ),
    antv("bar-stack", "堆叠柱状图", "compare"),
    antv("percentage-bar-stack", "百分比柱状图", "compare"),
    antv("bar-group", "分组柱状图", "compare"),
    antv("bar-group-stack", "分组堆叠柱状图", "compare"),
    antv("waterfall", "瀑布图", "compare", field_rule=FieldRule(1, 1, 1, 1)),
    antv("bar-horizontal", "基础条形图", "compare"),
    antv("bar-stack-horizontal", "堆叠条形图", "compare"),
    antv("percentage-bar-stack-horizontal", "百分比条形图", "compare"),
    antv("bar-range", "区间条形图", "compare", field_rule=_BAR_RANGE),
    antv("bidirectional-bar", "对称条形图", "compare", field_rule=_BI),
    antv("progress-bar", "进度条", "compare", field_rule=_PROGRESS),
    antv("stock-line", "K 线图", "compare", field_rule=_STOCK),
    antv("bullet-graph", "子弹图", "compare", field_rule=_BULLET),
)
