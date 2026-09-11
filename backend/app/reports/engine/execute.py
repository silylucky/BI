from __future__ import annotations

import time
import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.query.config_store.schemas import ConfigError, DatasetQueryConfigPayload
from app.query.config_store.service import get_config_by_id
from app.query.dataset.execute_config import execute_dataset_from_config
from app.query.dataset.schemas import DatasetExecuteRequest
from app.query.schemas import QueryError
from app.reports.engine.errors import RPT_ENGINE_DATASOURCE_REQUIRED, ReportEngineError
from app.reports.extension.schemas import ExtensionConfigOut, MetricAdjustment
from app.reports import label_translation


def execute_dataset_section(
    db: Session,
    user: UserContext,
    data_source_id: uuid.UUID,
    bound_config_id: uuid.UUID,
    parameters: dict[str, Any],
    *,
    limit: int = 100,
) -> dict[str, Any]:
    started = time.perf_counter()
    try:
        result = execute_dataset_from_config(
            db,
            user,
            DatasetExecuteRequest(
                dataSourceId=data_source_id,
                configId=bound_config_id,
                parameters=parameters,
                limit=limit,
                rls={"enabled": False},
            ),
        )
    except QueryError as exc:
        raise ReportEngineError("RPT_ENGINE_QUERY_FAILED", exc.message, exc.status) from exc
    elapsed_ms = (time.perf_counter() - started) * 1000
    return {
        "columns": result.columns,
        "rows": result.rows,
        "elapsedMs": round(elapsed_ms, 2),
    }


def _resolve_dataset_metric_binding(
    db: Session,
    metric: MetricAdjustment,
) -> tuple[uuid.UUID, uuid.UUID]:
    """Resolve live boundConfig + dataSource; prefer dataset's current binding over stale metric snapshot."""
    bound_id = metric.bound_config_id
    if metric.dataset_id:
        from app.metadata.dataset.errors import DatasetError
        from app.metadata.dataset import service as dataset_service

        try:
            ds_row = dataset_service.get_dataset(metric.dataset_id)
        except DatasetError as exc:
            raise ReportEngineError(
                "RPT_ENGINE_QUERY_FAILED",
                f"指标「{metric.key}」关联的数据集不存在或已删除（{metric.dataset_id}）",
                exc.status,
            ) from exc
        if ds_row.bound_config_id:
            bound_id = ds_row.bound_config_id
    if bound_id is None:
        raise ReportEngineError(
            RPT_ENGINE_DATASOURCE_REQUIRED,
            "数据集指标缺少绑定配置，请先保存出图字段并保存扩展配置",
            422,
        )
    try:
        record = get_config_by_id(db, bound_id)
        payload = DatasetQueryConfigPayload.model_validate(record.payload)
    except ConfigError as exc:
        raise ReportEngineError(
            "RPT_ENGINE_QUERY_FAILED",
            f"指标「{metric.key}」的查询绑定已失效，请在扩展配置中重新选择数据集并保存",
            exc.status,
        ) from exc
    return payload.data_source_id, bound_id


def _execute_metric(
    db: Session,
    user: UserContext,
    metric: MetricAdjustment,
    _fallback_data_source_id: uuid.UUID | None,
    parameters: dict[str, Any],
) -> dict[str, Any]:
    if not metric.bound_config_id and not metric.dataset_id:
        raise ReportEngineError(
            RPT_ENGINE_DATASOURCE_REQUIRED,
            "报表指标须绑定 Dataset 与查询配置",
            422,
        )
    ds_id, bound_id = _resolve_dataset_metric_binding(db, metric)
    return execute_dataset_section(db, user, ds_id, bound_id, parameters)


def build_sections_from_template_blocks(template_key: str) -> list[dict[str, Any]]:
    from app.reports.persistence import template_repo

    raw = template_repo.get_template(template_key)
    if raw is None:
        return []
    sections: list[dict[str, Any]] = []
    for block in raw.get("blocks", []):
        block_type = block.get("blockType") or block.get("block_type")
        if block_type == "sql":
            sections.append({
                "kind": "text",
                "title": block.get("title") or "SQL",
                "text": block.get("queryRef") or block.get("query_ref") or "",
                "placeholder": False,
            })
        elif block_type == "table":
            # tableRef binds extension metrics; extension rendering owns the section.
            if block.get("tableRef") or block.get("table_ref"):
                continue
            sections.append({
                "kind": "table",
                "title": block.get("title") or "Table",
                "columns": ["value"],
                "rows": [[block.get("title") or ""]],
                "placeholder": False,
            })
        elif block_type == "crosstab":
            continue
        elif block_type == "chart":
            sections.append({
                "kind": "chart",
                "title": block.get("title") or "Chart",
                "chartType": block.get("chartType") or block.get("chart_type") or "bar",
                "placeholder": False,
            })
    return sections


def _extension_has_executable_metrics(ext: ExtensionConfigOut) -> bool:
    for metric in ext.metrics:
        if not metric.visible:
            continue
        if metric.bound_config_id or metric.dataset_id:
            return True
    return False


def build_sections_from_extension(
    db: Session,
    user: UserContext,
    ext: ExtensionConfigOut,
    parameters: dict[str, Any],
    *,
    fallback_data_source_id: uuid.UUID | None = None,
) -> tuple[list[dict[str, Any]], float, dict[str, Any]]:
    sections: list[dict[str, Any]] = []
    total_ms = 0.0
    for metric in ext.metrics:
        if not metric.visible:
            continue
        payload = _execute_metric(db, user, metric, fallback_data_source_id, parameters)
        total_ms += float(payload["elapsedMs"])
        kind = "chart" if metric.compare_mode in {"yoy", "mom"} else "table"
        section: dict[str, Any] = {
            "kind": kind,
            "columns": payload["columns"],
            "rows": payload["rows"],
            "metricKey": metric.key,
            "placeholder": False,
        }
        if kind == "chart":
            section["chartType"] = "line" if metric.compare_mode == "mom" else "bar"
        sections.append(section)
    visible_metrics = [m for m in ext.metrics if m.visible]
    sections, translation_meta = label_translation.translate_extension_sections(
        db, sections, visible_metrics,
    )
    return sections, total_ms, translation_meta
