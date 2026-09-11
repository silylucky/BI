"""官方演示包 Dataset 预置（对标 DataEase「数据准备 → 【官方示例】」）。"""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.metadata.dataset.models import DatasetRecord

DEMO_DATASET_PREFIX = "demo-"
DEMO_DATASET_DISPLAY_PREFIX = "【官方示例】"

# 精简为四类典型：宽表出图、明细、地理、政务表格（数据量足够、覆盖主路径）
DEMO_DATASET_SPECS: tuple[dict[str, Any], ...] = (
    {
        "dataset_id": "demo-sales-wide",
        "display_name": "【官方示例】区域销售宽表",
        "tables": [{"name": "de_sales_wide"}],
    },
    {
        "dataset_id": "demo-sales-detail",
        "display_name": "【官方示例】销售明细",
        "tables": [{"name": "sales"}],
    },
    {
        "dataset_id": "demo-v-sales-geo",
        "display_name": "【官方示例】销售地理分布",
        "tables": [{"name": "v_sales_geo"}],
    },
    {
        "dataset_id": "demo-map-scatter",
        "display_name": "【官方示例】GIS 散点坐标",
        "tables": [{"name": "de_map_heat"}],
    },
    {
        "dataset_id": "demo-gov-grid-stats",
        "display_name": "【官方示例】网格事件统计",
        "tables": [{"name": "gov_grid_stats"}],
    },
)

DEMO_DATASET_IDS: frozenset[str] = frozenset(spec["dataset_id"] for spec in DEMO_DATASET_SPECS)

# 已下线官方 Dataset → 保留项（模板/存量看板改绑）
RETIRED_DEMO_DATASET_REMAP: dict[str, str] = {
    "demo-orders": "demo-sales-detail",
    "demo-daily-kpi": "demo-sales-wide",
    "demo-gov-service": "demo-sales-wide",
    "demo-gov-incidents": "demo-gov-grid-stats",
    "demo-gov-region-service": "demo-v-sales-geo",
    "demo-gov-hotwords": "demo-sales-wide",
    "demo-gov-issues": "demo-gov-grid-stats",
    "demo-gov-budget": "demo-sales-wide",
    "demo-gov-investment": "demo-sales-wide",
}

_RETIRED_FIELD_REMAP: dict[str, dict[str, str]] = {
    "demo-orders": {
        "order_date": "sale_date",
        "order_no": "channel",
        "status": "channel",
        "total_amount": "amount",
    },
    "demo-daily-kpi": {
        "stat_date": "sale_date",
        "metric_name": "product_name",
        "metric_code": "category_name",
        "value": "amount",
    },
    "demo-gov-service": {
        "stat_date": "sale_date",
        "department": "province",
        "metric_name": "product_name",
        "metric_code": "category_name",
        "value": "amount",
    },
    "demo-gov-incidents": {"incident_type": "grid_name", "count": "event_count"},
    "demo-gov-region-service": {"服务量": "amount", "service_volume": "amount"},
    "demo-gov-hotwords": {"word": "product_name", "weight": "amount", "热词": "product_name", "权重": "amount"},
    "demo-gov-issues": {
        "issue_type": "grid_name",
        "location": "grid_name",
        "unit": "grid_name",
        "status": "grid_name",
        "progress": "event_count",
    },
    "demo-gov-budget": {
        "category": "category_name",
        "spent_amount": "amount",
        "fiscal_year": "sale_date",
        "类别": "category_name",
        "支出金额": "amount",
    },
    "demo-gov-investment": {
        "industry": "category_name",
        "investment_amount": "amount",
        "产业": "category_name",
        "投资额": "amount",
    },
}


def is_demo_package_dataset(dataset_id: str | None, display_name: str | None = None) -> bool:
    did = (dataset_id or "").lower()
    if did.startswith(DEMO_DATASET_PREFIX):
        return True
    return (display_name or "").startswith(DEMO_DATASET_DISPLAY_PREFIX)


def remap_retired_demo_dataset_id(dataset_id: str | None) -> str | None:
    if not dataset_id:
        return dataset_id
    return RETIRED_DEMO_DATASET_REMAP.get(dataset_id, dataset_id)


def remap_retired_demo_field(dataset_id: str | None, field: str) -> str:
    mapping = _RETIRED_FIELD_REMAP.get(dataset_id or "")
    if not mapping:
        return field
    return mapping.get(field, field)


def _remap_field_refs(items: Any, old_dataset_id: str) -> None:
    if not isinstance(items, list):
        return
    for item in items:
        if not isinstance(item, dict):
            continue
        field = item.get("field")
        if isinstance(field, str):
            item["field"] = remap_retired_demo_field(old_dataset_id, field)


def remap_retired_demo_chart_config(chart_cfg: dict[str, Any]) -> dict[str, Any]:
    """单图：已下线官方 Dataset 改绑到保留项，并映射字段名。"""
    old_id = chart_cfg.get("datasetId")
    if not isinstance(old_id, str) or old_id not in RETIRED_DEMO_DATASET_REMAP:
        return chart_cfg
    _remap_field_refs(chart_cfg.get("dimensions"), old_id)
    _remap_field_refs(chart_cfg.get("metrics"), old_id)
    _remap_field_refs(chart_cfg.get("filters"), old_id)
    axes = chart_cfg.get("axes")
    if isinstance(axes, dict):
        for refs in axes.values():
            _remap_field_refs(refs, old_id)
    chart_cfg["datasetId"] = RETIRED_DEMO_DATASET_REMAP[old_id]
    chart_cfg["configId"] = None
    return chart_cfg


def remap_retired_demo_datasets_in_layout(layout: dict[str, Any]) -> dict[str, Any]:
    """把已下线官方 Dataset 改绑到保留项，并映射字段名。"""
    widgets = layout.get("widgets")
    if not isinstance(widgets, list):
        return layout
    for widget in widgets:
        if not isinstance(widget, dict) or widget.get("type") != "chart":
            continue
        chart_cfg = widget.get("chartConfig")
        if isinstance(chart_cfg, dict):
            remap_retired_demo_chart_config(chart_cfg)
    return layout


def seed_demo_datasets(db: Session) -> int:
    """幂等 upsert 官方示例 Dataset，并删除已下线的 demo-* 行。"""
    upserted = 0
    for spec in DEMO_DATASET_SPECS:
        row = db.get(DatasetRecord, spec["dataset_id"])
        if row is None:
            db.add(
                DatasetRecord(
                    dataset_id=spec["dataset_id"],
                    display_name=spec["display_name"],
                    tables=list(spec["tables"]),
                    computed_fields=[],
                    allowed_roles=["analyst", "viewer"],
                    bound_config_id=None,
                ),
            )
            upserted += 1
        else:
            row.display_name = spec["display_name"]
            row.tables = list(spec["tables"])
            row.allowed_roles = ["analyst", "viewer"]
    pruned = _prune_retired_demo_datasets(db)
    db.commit()
    return upserted + pruned


def _prune_retired_demo_datasets(db: Session) -> int:
    rows = list(
        db.scalars(
            select(DatasetRecord).where(DatasetRecord.dataset_id.like(f"{DEMO_DATASET_PREFIX}%")),
        ),
    )
    removed = 0
    for row in rows:
        if row.dataset_id in DEMO_DATASET_IDS:
            continue
        db.delete(row)
        removed += 1
    return removed


def resolve_demo_dataset_ids(db: Session) -> list[str]:
    rows = db.scalars(
        select(DatasetRecord.dataset_id).where(
            DatasetRecord.dataset_id.in_(DEMO_DATASET_IDS),
        ),
    ).all()
    return list(rows)
