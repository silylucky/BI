"""内置模板图表改绑到精简后的 4 个官方 Dataset，并补齐合法维/指。"""

from __future__ import annotations

from typing import Any

from app.dashboard.templates.demo_datasource import TEMPLATE_DEMO_DATASOURCE_REF

WIDE = "demo-sales-wide"
DETAIL = "demo-sales-detail"
GEO = "demo-v-sales-geo"
GRID = "demo-gov-grid-stats"

_GRID_TITLE_KEYS = ("网格", "事件", "待办", "台账", "整改", "发现")
_MAP_TITLE_KEYS = ("热力", "区域分布", "区域态势", "地图")
_GOV_ANALYTICS_KEYS = ("政务", "满意度", "水质", "效能", "部门")


def _refs(fields: list[str]) -> list[dict[str, Any]]:
    return [{"field": name, "label": None} for name in fields]


def _axes(mapping: dict[str, list[str]]) -> dict[str, list[dict[str, Any]]]:
    return {key: _refs(names) for key, names in mapping.items()}


def _pack(
    dataset_id: str,
    dims: list[str],
    mets: list[str],
    axes: dict[str, list[str]],
) -> tuple[str, list[str], list[str], dict[str, list[str]]]:
    return dataset_id, dims, mets, axes


def encoding_for(chart_type: str, title: str) -> tuple[str, list[str], list[str], dict[str, list[str]]]:
    """按图类型 + 标题语义选择 Dataset 与字段。"""
    title = title or ""
    if chart_type in {"map", "map-3d"} or any(key in title for key in _MAP_TITLE_KEYS):
        return _pack(
            GEO,
            ["province", "city", "district"],
            ["amount"],
            {"xAxis": ["province"], "yAxis": ["amount"], "drill": ["city", "district"]},
        )
    gridish = any(key in title for key in _GRID_TITLE_KEYS)
    if gridish and chart_type in {"table-info", "table", "table-normal"}:
        cols = ["grid_name", "event_count", "resolved_count"]
        return _pack(GRID, cols, [], {"xAxis": cols})
    if gridish and chart_type in {
        "bar-range",
        "bidirectional-bar",
        "bullet-graph",
        "quadrant",
        "scatter",
        "chart-mix-group",
        "bar-stack",
        "bar-stack-horizontal",
    }:
        return _pack(
            GRID,
            ["grid_name"],
            ["event_count", "resolved_count"],
            {"xAxis": ["grid_name"], "yAxis": ["event_count"], "yAxisExt": ["resolved_count"]},
        )
    if gridish:
        return _pack(
            GRID,
            ["grid_name"],
            ["event_count"],
            {"xAxis": ["grid_name"], "yAxis": ["event_count"]},
        )

    govish = any(key in title for key in _GOV_ANALYTICS_KEYS)
    if govish:
        if chart_type in {"map", "map-3d"} or any(key in title for key in _MAP_TITLE_KEYS):
            return _pack(
                GEO,
                ["province", "city", "district"],
                ["amount"],
                {"xAxis": ["province"], "yAxis": ["amount"], "drill": ["city", "district"]},
            )
        if chart_type == "gauge" or "水质" in title:
            return _pack(GRID, [], ["resolved_count"], {"yAxis": ["resolved_count"]})
        if chart_type in {"line", "area", "timeline"} or "趋势" in title:
            return _pack(WIDE, ["sale_date"], ["amount"], {"xAxis": ["sale_date"], "yAxis": ["amount"]})
        if chart_type == "bar-stack-horizontal":
            return _pack(
                GRID,
                ["grid_name"],
                ["event_count", "resolved_count"],
                {"xAxis": ["grid_name"], "yAxis": ["event_count", "resolved_count"]},
            )
        if chart_type in {"bar-stack", "chart-mix-group", "chart-mix-stack"}:
            return _pack(
                GRID,
                ["grid_name"],
                ["event_count", "resolved_count"],
                {"xAxis": ["grid_name"], "yAxis": ["event_count", "resolved_count"]},
            )
        if chart_type == "bar":
            return _pack(GRID, ["grid_name"], ["event_count"], {"xAxis": ["grid_name"], "yAxis": ["event_count"]})
        return _pack(GRID, ["grid_name"], ["event_count"], {"xAxis": ["grid_name"], "yAxis": ["event_count"]})

    catalog: dict[str, tuple[str, list[str], list[str], dict[str, list[str]]]] = {
        "kpi": _pack(WIDE, [], ["amount"], {"yAxis": ["amount"]}),
        "gauge": _pack(WIDE, [], ["amount"], {"yAxis": ["amount"]}),
        "liquid": _pack(WIDE, [], ["amount"], {"yAxis": ["amount"]}),
        "line": _pack(WIDE, ["sale_date"], ["amount"], {"xAxis": ["sale_date"], "yAxis": ["amount"]}),
        "area": _pack(WIDE, ["sale_date"], ["amount"], {"xAxis": ["sale_date"], "yAxis": ["amount"]}),
        "area-stack": _pack(WIDE, ["sale_date"], ["amount"], {"xAxis": ["sale_date"], "yAxis": ["amount"]}),
        "timeline": _pack(WIDE, ["sale_date"], ["amount"], {"xAxis": ["sale_date"], "yAxis": ["amount"]}),
        "chart-mix": _pack(WIDE, ["sale_date"], ["amount"], {"xAxis": ["sale_date"], "yAxis": ["amount"]}),
        "chart-mix-group": _pack(
            WIDE, ["sale_date"], ["amount", "quantity"],
            {"xAxis": ["sale_date"], "yAxis": ["amount"], "yAxisExt": ["quantity"]},
        ),
        "chart-mix-stack": _pack(
            WIDE, ["sale_date"], ["amount", "quantity"],
            {"xAxis": ["sale_date"], "yAxis": ["amount"], "yAxisExt": ["quantity"]},
        ),
        "bar": _pack(WIDE, ["category_name"], ["amount"], {"xAxis": ["category_name"], "yAxis": ["amount"]}),
        "bar-horizontal": _pack(WIDE, ["province"], ["amount"], {"xAxis": ["province"], "yAxis": ["amount"]}),
        "bar-stack": _pack(
            WIDE, ["category_name"], ["amount", "quantity"],
            {"xAxis": ["category_name"], "yAxis": ["amount", "quantity"]},
        ),
        "bar-stack-horizontal": _pack(
            WIDE, ["category_name"], ["amount", "quantity"],
            {"xAxis": ["category_name"], "yAxis": ["amount", "quantity"]},
        ),
        "bar-group": _pack(WIDE, ["category_name"], ["amount"], {"xAxis": ["category_name"], "yAxis": ["amount"]}),
        "pie": _pack(WIDE, ["category_name"], ["amount"], {"xAxis": ["category_name"], "yAxis": ["amount"]}),
        "pie-donut": _pack(WIDE, ["category_name"], ["amount"], {"xAxis": ["category_name"], "yAxis": ["amount"]}),
        "pie-rose": _pack(WIDE, ["category_name"], ["amount"], {"xAxis": ["category_name"], "yAxis": ["amount"]}),
        "pie-donut-rose": _pack(WIDE, ["category_name"], ["amount"], {"xAxis": ["category_name"], "yAxis": ["amount"]}),
        "radar": _pack(WIDE, ["category_name"], ["amount"], {"xAxis": ["category_name"], "yAxis": ["amount"]}),
        "treemap": _pack(WIDE, ["category_name"], ["amount"], {"xAxis": ["category_name"], "yAxis": ["amount"]}),
        "circle-packing": _pack(WIDE, ["category_name"], ["amount"], {"xAxis": ["category_name"], "yAxis": ["amount"]}),
        "funnel": _pack(WIDE, ["category_name"], ["amount"], {"xAxis": ["category_name"], "yAxis": ["amount"]}),
        "word-cloud": _pack(WIDE, ["product_name"], ["amount"], {"xAxis": ["product_name"], "yAxis": ["amount"]}),
        "scatter": _pack(
            WIDE, ["product_name"], ["quantity", "amount"],
            {"xAxis": ["product_name"], "yAxis": ["quantity"], "yAxisExt": ["amount"]},
        ),
        "quadrant": _pack(
            WIDE, ["product_name"], ["amount", "quantity"],
            {"xAxis": ["product_name"], "yAxis": ["amount"], "yAxisExt": ["quantity"], "extBubble": ["quantity"]},
        ),
        "bar-range": _pack(
            WIDE, ["category_name"], ["amount", "quantity"],
            {"xAxis": ["category_name"], "yAxis": ["amount"], "yAxisExt": ["quantity"]},
        ),
        "bidirectional-bar": _pack(
            DETAIL, ["channel"], ["quantity", "amount"],
            {"xAxis": ["channel"], "yAxis": ["quantity"], "yAxisExt": ["amount"]},
        ),
        "bullet-graph": _pack(
            WIDE, ["category_name"], ["amount", "quantity"],
            {"xAxis": ["category_name"], "yAxis": ["amount"], "yAxisExt": ["quantity"]},
        ),
        "stock-line": _pack(
            WIDE, ["sale_date"], ["amount", "quantity", "amount", "quantity"],
            {"xAxis": ["sale_date"], "yAxis": ["amount", "quantity", "amount", "quantity"]},
        ),
        "table-info": _pack(
            WIDE, ["product_name", "category_name", "province"], [],
            {"xAxis": ["product_name", "category_name", "province"]},
        ),
        "table-normal": _pack(
            WIDE, ["sale_date", "province", "category_name"], ["amount", "quantity"],
            {"xAxis": ["sale_date", "province", "category_name"], "yAxis": ["amount", "quantity"]},
        ),
        "table-pivot": _pack(
            WIDE, ["category_name", "province"], ["amount"],
            {"xAxis": ["category_name", "province"], "yAxis": ["amount"]},
        ),
    }
    if chart_type in catalog:
        return catalog[chart_type]
    return _pack(WIDE, ["sale_date"], ["amount"], {"xAxis": ["sale_date"], "yAxis": ["amount"]})


def _empty_chart_config(widget_id: str, chart_type: str) -> dict[str, Any]:
    return {
        "chartType": chart_type,
        "styleVariant": "default",
        "dataSourceId": TEMPLATE_DEMO_DATASOURCE_REF,
        "bindingId": None,
        "chartId": widget_id,
        "mode": "dataset",
        "sql": None,
        "schema": None,
        "table": None,
        "configId": None,
        "datasetId": None,
        "nativeBody": {"deStyle": {"legend": {"show": True}}},
        "index": None,
        "dimensions": [],
        "metrics": [],
        "axes": None,
        "filters": [],
        "timeRange": None,
    }


def apply_encoding_to_chart_config(cfg: dict[str, Any], title: str, *, kpi_alt: bool = False) -> None:
    chart_type = cfg.get("chartType") or "area"
    cfg["chartType"] = chart_type
    cfg["mode"] = "dataset"
    cfg["dataSourceId"] = TEMPLATE_DEMO_DATASOURCE_REF
    cfg["sql"] = None
    dataset_id, dims, mets, axes = encoding_for(str(chart_type), title)
    if chart_type == "kpi" and kpi_alt:
        mets = ["quantity"]
        axes = {"yAxis": ["quantity"]}
    cfg["datasetId"] = dataset_id
    cfg["configId"] = None
    cfg["dimensions"] = _refs(dims)
    cfg["metrics"] = _refs(mets)
    cfg["axes"] = _axes(axes)


def rebind_chart_widget(widget: dict[str, Any], *, kpi_alt: bool = False) -> None:
    cfg = widget.get("chartConfig")
    if not isinstance(cfg, dict):
        title = str(widget.get("title") or "")
        chart_type = "area" if "面积" in title else "bar"
        widget["title"] = title if title and not title.startswith("未命名") else "趋势"
        cfg = _empty_chart_config(str(widget.get("id") or ""), chart_type)
        widget["chartConfig"] = cfg
        widget["componentRef"] = None
    apply_encoding_to_chart_config(cfg, str(widget.get("title") or ""), kpi_alt=kpi_alt)


def rebind_layout_demo_encodings(layout: dict[str, Any]) -> dict[str, Any]:
    widgets = layout.get("widgets")
    if not isinstance(widgets, list):
        return layout
    kpi_n = 0
    for widget in widgets:
        if not isinstance(widget, dict) or widget.get("type") != "chart":
            continue
        cfg = widget.get("chartConfig") if isinstance(widget.get("chartConfig"), dict) else {}
        is_kpi = cfg.get("chartType") == "kpi"
        rebind_chart_widget(widget, kpi_alt=is_kpi and kpi_n % 2 == 1)
        if is_kpi:
            kpi_n += 1
    return layout
