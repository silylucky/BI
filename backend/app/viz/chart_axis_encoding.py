"""DE 命名轴 → legacy dimensions/metrics 投影（与 fe/resolveChartEncoding 对齐）。"""

from __future__ import annotations

from app.schemas.chart_view import ChartFieldRef

_DE_AXIS_IDS = frozenset(
    {"xAxis", "yAxis", "yAxisExt", "xAxisExt", "extBubble", "extColor", "drill", "extStack", "filter"}
)

_GIS_MAP_SLOTS: tuple[tuple[str, int, str], ...] = (
    ("xAxis", 0, "dimension"),
    ("xAxisExt", 0, "dimension"),
    ("drill", 0, "dimension"),
    ("yAxis", 0, "metric"),
)


def _axis_ref(axes: dict[str, list[ChartFieldRef]], axis_id: str, index: int) -> ChartFieldRef | None:
    refs = axes.get(axis_id) or []
    if index >= len(refs):
        return None
    ref = refs[index]
    field = ref.field.strip()
    if not field:
        return None
    return ChartFieldRef(field=field, label=ref.label)


def project_axes_to_legacy_fields(
    chart_type: str,
    axes: dict[str, list[ChartFieldRef]] | None,
) -> tuple[list[ChartFieldRef], list[ChartFieldRef]] | None:
    if not axes:
        return None
    cleaned = {k: v for k, v in axes.items() if k in _DE_AXIS_IDS and v}
    if not cleaned:
        return None

    if chart_type == "gis-map":
        dimensions: list[ChartFieldRef] = []
        metrics: list[ChartFieldRef] = []
        for axis_id, index, kind in _GIS_MAP_SLOTS:
            ref = _axis_ref(cleaned, axis_id, index)
            if not ref:
                continue
            if kind == "metric":
                metrics.append(ref)
            else:
                dimensions.append(ref)
        return dimensions, metrics

    return None
