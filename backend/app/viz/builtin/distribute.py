from __future__ import annotations

from app.viz.builtin._helpers import PIE_RULE, antv

DISTRIBUTE_SPECS = (
    antv("pie", "饼图", "distribute", field_rule=PIE_RULE),
    antv("pie-donut", "环形图", "distribute", field_rule=PIE_RULE),
    antv("pie-rose", "玫瑰图", "distribute", field_rule=PIE_RULE),
    antv("pie-donut-rose", "玫瑰环形图", "distribute", field_rule=PIE_RULE),
    antv("radar", "雷达图", "distribute", field_rule=PIE_RULE),
    antv("treemap", "矩形树图", "distribute", field_rule=PIE_RULE),
    antv("word-cloud", "词云图", "distribute", field_rule=PIE_RULE),
    antv(
        "wordCloud",
        "词云（旧 ID）",
        "distribute",
        field_rule=PIE_RULE,
        deprecated=True,
        migrates_to="word-cloud",
    ),
)
