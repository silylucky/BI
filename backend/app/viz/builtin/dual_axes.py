from __future__ import annotations

from app.viz.builtin._helpers import COMBO_RULE, DUAL_LINE_RULE, antv

DUAL_AXES_SPECS = (
    antv(
        "combo",
        "折柱组合（已弃用）",
        "dual_axes",
        field_rule=COMBO_RULE,
        deprecated=True,
        migrates_to="chart-mix",
    ),
    antv("chart-mix", "柱线组合图", "dual_axes", field_rule=COMBO_RULE),
    antv("chart-mix-group", "分组柱线组合图", "dual_axes", field_rule=COMBO_RULE),
    antv("chart-mix-stack", "堆叠柱线组合图", "dual_axes", field_rule=COMBO_RULE),
    antv("chart-mix-dual-line", "双线组合图", "dual_axes", field_rule=DUAL_LINE_RULE),
)
