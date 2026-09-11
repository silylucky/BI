from __future__ import annotations

from app.viz.specs import FieldRule

from app.viz.builtin._helpers import FLOW_RULE, GRAPH_RULE, MULTI_SCATTER_RULE, PIE_RULE, QUADRANT_RULE, SCATTER_RULE, antv

RELATION_SPECS = (
    antv("scatter", "散点图", "relation", field_rule=SCATTER_RULE),
    antv("quadrant", "象限图", "relation", field_rule=QUADRANT_RULE),
    antv("funnel", "漏斗图", "relation", field_rule=FieldRule(1, 1, 1, 1)),
    antv("sankey", "桑基图", "relation", field_rule=FLOW_RULE, note="桑基图需 2 个维度与 1 个度量"),
    antv("circle-packing", "圆形填充图", "relation", field_rule=PIE_RULE),
    antv("multi-scatter", "多维散点图", "relation", field_rule=MULTI_SCATTER_RULE),
    antv("graph", "关系图", "relation", library="g6", field_rule=GRAPH_RULE, style_variants=("force", "dagre")),
)
