from __future__ import annotations

from app.viz.builtin._helpers import GAUGE_RULE, antv, kpi_type

QUOTA_SPECS = (
    antv("gauge", "仪表盘", "quota", library="g2plot", field_rule=GAUGE_RULE, style_variants=("default", "progress")),
    antv("liquid", "水波图", "quota", library="g2plot", field_rule=GAUGE_RULE),
    kpi_type(),
)
