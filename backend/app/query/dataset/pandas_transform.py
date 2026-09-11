"""查询出数后 pandas 清洗（Dataset execute 与 /query/execute 共用 etl_rules 引擎）。"""

from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass
from typing import Any

from sqlalchemy.orm import Session

from app.ingestion.etl_rules import apply_rules
from app.metadata.dataset.schemas import DatasetItemOut
from app.query.executor import QueryResult
from app.query.schemas import QueryError

logger = logging.getLogger(__name__)

probe_dataset_pandas_budget_ms_limit = 100


@dataclass(frozen=True)
class DatasetPandasProbeResult:
    elapsed_ms: float
    ok: bool


def needs_query_time_pandas(
    db: Session | None = None,
    dataset: DatasetItemOut | None = None,
    _data_source_id: uuid.UUID | None = None,
) -> bool:
    """manual / 外部源 Dataset 查询后 pandas 清洗；sync_job 产物已在写库前清洗。"""
    if dataset is not None and dataset.origin == "sync_job":
        return False
    if db is not None and dataset is not None:
        from app.metadata.dataset.models import DatasetRecord

        row = db.get(DatasetRecord, dataset.dataset_id)
        if row is not None and row.origin == "sync_job":
            return False
    return True


def resolve_dataset_transform_rules(session: Session, dataset: DatasetItemOut | None) -> list[dict[str, Any]]:
    """加载 Dataset 查询清洗规则；无 Dataset 绑定时返回空列表（仍执行 auto_profile）。"""
    from app.metadata.dataset.transform_rules import resolve_transform_rules_for_dataset

    return resolve_transform_rules_for_dataset(session, dataset)


def rows_to_records(columns: list[str], rows: list[list[Any]]) -> list[dict[str, Any]]:
    return [dict(zip(columns, row, strict=False)) for row in rows]


def _output_columns(original: list[str], records: list[dict[str, Any]]) -> list[str]:
    if not records:
        return original
    seen: set[str] = set()
    out: list[str] = []
    for rec in records:
        for key in rec:
            if key not in seen:
                seen.add(key)
                out.append(key)
    return out or original


def records_to_query_result(
    columns: list[str],
    records: list[dict[str, Any]],
    *,
    truncated: bool,
) -> QueryResult:
    out_columns = _output_columns(columns, records)
    rows = [[rec.get(col) for col in out_columns] for rec in records]
    return QueryResult(
        columns=out_columns,
        rows=rows,
        row_count=len(rows),
        truncated=truncated,
    )


def apply_query_transform(records: list[dict[str, Any]], rules: list[dict[str, Any]]) -> list[dict[str, Any]]:
    try:
        return apply_rules(records, rules)
    except Exception as exc:  # noqa: BLE001 — 用户可读摘要
        raise QueryError("QUERY_DATASET_TRANSFORM_FAILED", str(exc)[:500], 422) from exc


def apply_pandas_to_query_result(
    result: QueryResult,
    rules: list[dict[str, Any]] | None = None,
) -> QueryResult:
    records = rows_to_records(result.columns, result.rows)
    rows_in = len(records)
    cleaned = apply_query_transform(records, rules or [])
    rows_out = len(cleaned)
    logger.info(
        "query_pandas_transform pandasTransform=true rowsIn=%s rowsOut=%s",
        rows_in,
        rows_out,
    )
    return records_to_query_result(result.columns, cleaned, truncated=result.truncated)


def transform_query_result(
    db: Session,
    dataset: DatasetItemOut | None,
    data_source_id: uuid.UUID,
    result: QueryResult,
    rules: list[dict[str, Any]] | None = None,
) -> QueryResult:
    if not needs_query_time_pandas(db, dataset, data_source_id):
        return result
    return apply_pandas_to_query_result(result, rules)


def probe_dataset_pandas_budget_ms() -> DatasetPandasProbeResult:
    start = time.perf_counter()
    apply_query_transform(
        [{"product_name": "  A  ", "amount": "12.5", "status": "active"}],
        [],
    )
    elapsed = (time.perf_counter() - start) * 1000
    return DatasetPandasProbeResult(
        elapsed_ms=elapsed,
        ok=elapsed < probe_dataset_pandas_budget_ms_limit,
    )
