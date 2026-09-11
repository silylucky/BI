"""SQL→Dataset 迁移残留的中文别名 → 物理列（与官方示例表对齐）。"""

from __future__ import annotations

from typing import Any

LEGACY_SQL_FIELD_ALIASES: dict[str, str] = {
    "网格": "grid_name",
    "事件数": "event_count",
    "已办结": "resolved_count",
    "省份": "province",
    "城市": "city",
    "区县": "district",
    "服务量": "service_volume",
    "事件类型": "incident_type",
    "数量": "count",
    "热词": "word",
    "权重": "weight",
    "问题类型": "issue_type",
    "地点": "location",
    "责任单位": "unit",
    "状态": "status",
    "进度": "progress",
    "类别": "category",
    "支出金额": "spent_amount",
    "产业": "industry",
    "投资额": "investment_amount",
    "指标": "metric_name",
    "数值": "value",
}


def remap_legacy_sql_field(field: str) -> str:
    trimmed = field.strip()
    return LEGACY_SQL_FIELD_ALIASES.get(trimmed, trimmed)


def _remap_field_list(items: Any) -> Any:
    if not isinstance(items, list):
        return items
    next_items: list[Any] = []
    for item in items:
        if not isinstance(item, dict):
            next_items.append(item)
            continue
        field = item.get("field")
        if not isinstance(field, str):
            next_items.append(item)
            continue
        mapped = remap_legacy_sql_field(field)
        next_items.append(item if mapped == field else {**item, "field": mapped})
    return next_items


def remap_legacy_sql_fields_in_chart_config(chart_cfg: dict[str, Any]) -> dict[str, Any]:
    out = dict(chart_cfg)
    if "dimensions" in out:
        out["dimensions"] = _remap_field_list(out.get("dimensions"))
    if "metrics" in out:
        out["metrics"] = _remap_field_list(out.get("metrics"))
    axes = out.get("axes")
    if isinstance(axes, dict):
        out["axes"] = {key: _remap_field_list(value) for key, value in axes.items()}
    return out
