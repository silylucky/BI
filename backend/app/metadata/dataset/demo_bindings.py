"""官方示例 Dataset 自动绑定 dataset_query 配置（图表编辑 Dataset 模式即开即用）。"""

from __future__ import annotations

import copy
import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.dashboard.templates.demo_datasource import (
    TEMPLATE_DEMO_DATASOURCE_REF,
    resolve_official_demo_connection,
    resolve_sample_db_datasource_id,
)
from app.metadata.dataset.demo_seed import DEMO_DATASET_SPECS, remap_retired_demo_datasets_in_layout
from app.metadata.dataset.models import DatasetRecord
from app.query.config_store.models import QueryConfigRecord
from app.query.config_store.schemas import ConfigUpsert
from app.query.config_store.service import upsert_config

_DEMO_DATASET_BINDING_SPECS: dict[str, dict[str, object]] = {
    "demo-sales-wide": {
        "table": "de_sales_wide",
        "columns": ["sale_date", "province", "amount", "quantity", "product_name", "category_name"],
    },
    "demo-sales-detail": {
        "table": "sales",
        "columns": ["sale_date", "amount", "quantity", "channel"],
    },
    "demo-gov-grid-stats": {
        "table": "gov_grid_stats",
        "columns": ["grid_name", "event_count", "resolved_count"],
    },
    "demo-v-sales-geo": {
        "table": "v_sales_geo",
        "columns": ["province", "city", "district", "amount"],
    },
    "demo-map-scatter": {
        "table": "de_map_heat",
        "columns": ["point_name", "lng", "lat", "amount", "province", "city"],
    },
}


def _stable_ref_id(dataset_id: str) -> uuid.UUID:
    return uuid.uuid5(uuid.NAMESPACE_DNS, f"vitalspan.demo.dataset.{dataset_id}")


def _build_demo_binding_payload(
    data_source_id: uuid.UUID,
    binding: dict[str, object],
) -> dict[str, object]:
    schema = resolve_official_demo_connection().database
    return {
        "dataSourceId": str(data_source_id),
        "connectorType": "mysql",
        "schema": schema,
        "table": binding["table"],
        "columns": binding["columns"],
        "conditions": {"logic": "AND", "conditions": []},
        "limit": 1000,
        "offset": 0,
    }


def _binding_payload_needs_repair(current: dict[str, object], expected: dict[str, object]) -> bool:
    keys = ("dataSourceId", "connectorType", "schema", "table", "columns")
    return any(current.get(key) != expected.get(key) for key in keys)


def ensure_demo_dataset_bindings(db: Session) -> int:
    """为官方示例 Dataset 幂等创建/修复 dataset_query 绑定。"""
    data_source_id = resolve_sample_db_datasource_id(db)
    if data_source_id is None:
        return 0

    touched = 0

    for spec in DEMO_DATASET_SPECS:
        dataset_id = spec["dataset_id"]
        binding = _DEMO_DATASET_BINDING_SPECS.get(dataset_id)
        if binding is None:
            continue

        row = db.get(DatasetRecord, dataset_id)
        if row is None:
            continue

        expected_payload = _build_demo_binding_payload(data_source_id, binding)

        if row.bound_config_id is None:
            record = upsert_config(
                db,
                ConfigUpsert.model_validate(
                    {
                        "configType": "dataset_query",
                        "schemaVersion": "1.0",
                        "refType": "dataset",
                        "refId": str(_stable_ref_id(dataset_id)),
                        "payload": expected_payload,
                    },
                ),
            )
            row.bound_config_id = record.id
            db.commit()
            touched += 1
            continue

        record = db.get(QueryConfigRecord, row.bound_config_id)
        if record is None:
            row.bound_config_id = None
            db.commit()
            record = upsert_config(
                db,
                ConfigUpsert.model_validate(
                    {
                        "configType": "dataset_query",
                        "schemaVersion": "1.0",
                        "refType": "dataset",
                        "refId": str(_stable_ref_id(dataset_id)),
                        "payload": expected_payload,
                    },
                ),
            )
            row.bound_config_id = record.id
            db.commit()
            touched += 1
            continue

        current_payload = record.payload if isinstance(record.payload, dict) else {}
        if not _binding_payload_needs_repair(current_payload, expected_payload):
            continue

        record.payload = expected_payload
        record.revision += 1
        db.commit()
        touched += 1

    return touched


def bind_demo_dataset_config_ids(db: Session, layout: dict[str, Any]) -> dict[str, Any]:
    """将官方示例 Dataset 的 bound_config_id 写入 layout（跨环境分享/embed 可复用）。"""
    cloned = remap_retired_demo_datasets_in_layout(copy.deepcopy(layout))
    widgets = cloned.get("widgets")
    if not isinstance(widgets, list):
        return cloned
    demo_ds = resolve_sample_db_datasource_id(db)
    for widget in widgets:
        if not isinstance(widget, dict) or widget.get("type") != "chart":
            continue
        chart_cfg = widget.get("chartConfig")
        if not isinstance(chart_cfg, dict) or chart_cfg.get("mode") != "dataset":
            continue
        dataset_id = chart_cfg.get("datasetId")
        if not dataset_id:
            continue
        row = db.get(DatasetRecord, dataset_id)
        if row is None or row.bound_config_id is None:
            continue
        chart_cfg["configId"] = str(row.bound_config_id)
        if demo_ds is not None:
            chart_cfg["dataSourceId"] = str(demo_ds)
    return cloned


def prepare_chart_config_for_embed(db: Session, chart_config: dict[str, Any]) -> dict[str, Any]:
    """单图 embed：绑定演示数据源与 Dataset configId。"""
    ensure_demo_dataset_bindings(db)
    from app.metadata.dataset.demo_seed import remap_retired_demo_chart_config

    cfg = remap_retired_demo_chart_config(copy.deepcopy(chart_config))
    demo_ds = resolve_sample_db_datasource_id(db)
    current = cfg.get("dataSourceId")
    if demo_ds is not None and current in (None, "", TEMPLATE_DEMO_DATASOURCE_REF):
        cfg["dataSourceId"] = str(demo_ds)
    if cfg.get("mode") == "dataset":
        dataset_id = cfg.get("datasetId")
        if dataset_id:
            row = db.get(DatasetRecord, dataset_id)
            if row is not None and row.bound_config_id is not None:
                cfg["configId"] = str(row.bound_config_id)
                if demo_ds is not None:
                    cfg["dataSourceId"] = str(demo_ds)
    return cfg
