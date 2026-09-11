from __future__ import annotations

from app.viz.specs import ChartTypeSpec, FieldRule

CAPS = ("style_variant", "field_config", "render_spec")

CARTESIAN = FieldRule(1, 8, 1, 8)
PIE_RULE = FieldRule(1, 1, 1, 1)
SCATTER_RULE = FieldRule(1, 2, 1, 2)
QUADRANT_RULE = FieldRule(1, 2, 2, 2)
MULTI_SCATTER_RULE = FieldRule(1, 2, 2, 4)
FLOW_RULE = FieldRule(2, 2, 1, 1)
GRAPH_RULE = FieldRule(2, 2, 0, 1, note="关系图需 2 个维度（起点、终点）；网络拓扑适合网状关系，流向分层适合起点→终点")
TABLE_RULE = FieldRule(0, 8, 0, 8)
KPI_RULE = FieldRule(0, 1, 1, 1)
GAUGE_RULE = FieldRule(0, 0, 1, 1)
MAP_RULE = FieldRule(1, 3, 1, 1)
GIS_MAP_RULE = FieldRule(
    0,
    3,
    0,
    1,
    note="底图无需字段；可选经纬度散点叠加",
)
HEATMAP_MATRIX = FieldRule(2, 2, 1, 1)
COMBO_RULE = FieldRule(1, 8, 1, 8, note="左柱或右线至少 1 个指标")
DUAL_LINE_RULE = FieldRule(1, 8, 1, 8)


def antv(
    type: str,
    display_name: str,
    palette_category: str,
    *,
    library: str = "g2plot",
    category: str = "basic",
    style_variants: tuple[str, ...] = ("default",),
    field_rule: FieldRule = CARTESIAN,
    deprecated: bool = False,
    migrates_to: str | None = None,
    note: str = "",
) -> ChartTypeSpec:
    fr = FieldRule(
        field_rule.min_dimensions,
        field_rule.max_dimensions,
        field_rule.min_metrics,
        field_rule.max_metrics,
        note or field_rule.note,
    )
    return ChartTypeSpec(
        type,
        display_name,
        category,
        "antv",
        CAPS,
        style_variants,
        fr,
        library=library,
        palette_category=palette_category,
        deprecated=deprecated,
        migrates_to=migrates_to,
    )


def react_type(
    type: str,
    display_name: str,
    palette_category: str,
    *,
    library: str = "react",
    renderer: str = "table",
    field_rule: FieldRule = TABLE_RULE,
    deprecated: bool = False,
    migrates_to: str | None = None,
) -> ChartTypeSpec:
    return ChartTypeSpec(
        type,
        display_name,
        "basic",
        renderer,
        CAPS,
        ("default",),
        field_rule,
        library=library,
        palette_category=palette_category,
        deprecated=deprecated,
        migrates_to=migrates_to,
    )


def kpi_type() -> ChartTypeSpec:
    return ChartTypeSpec(
        "kpi",
        "指标卡",
        "indicator",
        "kpi",
        CAPS,
        ("default",),
        KPI_RULE,
        library="react",
        palette_category="quota",
    )
