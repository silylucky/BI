from __future__ import annotations

from app.viz.specs import FieldRule

from app.viz.builtin._helpers import HEATMAP_MATRIX, TABLE_RULE, antv, react_type

TABLE_NORMAL_RULE = FieldRule(1, 8, 1, 8)
TABLE_PIVOT_RULE = FieldRule(1, 8, 1, 8)

TABLE_SPECS = (
    react_type(
        "table",
        "表格（已弃用）",
        "table",
        deprecated=True,
        migrates_to="table-info",
    ),
    antv("table-info", "明细表", "table", library="s2", field_rule=TABLE_RULE),
    antv("table-normal", "汇总表", "table", library="s2", field_rule=TABLE_NORMAL_RULE),
    antv("table-pivot", "透视表", "table", library="s2", field_rule=TABLE_PIVOT_RULE),
    antv("t-heatmap", "热力图", "table", library="g2plot", field_rule=HEATMAP_MATRIX),
)
