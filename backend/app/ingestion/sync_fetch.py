from __future__ import annotations

from typing import Any

from app.ingestion.models import SyncJob
from app.ingestion.sync_fetch_native import fetch_native_rows_result
from app.ingestion.sync_fetch_sql import fetch_sql_rows_result
from app.ingestion.sync_types import SyncFetchResult
from app.ingestion.sync_source_capabilities import (
    is_sync_fetch_implemented,
    resolve_sql_dialect_for_sync,
    resolve_sync_fetch_mode,
    sync_fetch_not_implemented_message,
)
from app.ingestion.sync_source_table import validate_sync_source_table
from app.query.rls.guard import validate_identifier


def validate_sync_table_names(source_type: str, source_table: str, target_table: str) -> None:
    validate_sync_source_table(source_type, source_table)
    validate_identifier(target_table)


def _watermark_greater(candidate: object, baseline: object) -> bool:
    try:
        return float(candidate) > float(baseline)
    except (TypeError, ValueError):
        return str(candidate) > str(baseline)


def _watermark_sort_key(value: object) -> tuple[int, float | str]:
    try:
        return (0, float(value))  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return (1, str(value))


def _max_watermark(rows: list[dict[str, Any]], column: str) -> str | None:
    if not rows:
        return None
    values = [row.get(column) for row in rows if row.get(column) is not None]
    if not values:
        return None
    return str(max(values, key=_watermark_sort_key))


def compute_next_watermark(job: SyncJob, rows: list[dict[str, Any]]) -> str | None:
    if job.sync_mode != "incremental" or not job.incremental_column:
        return None
    candidate = _max_watermark(rows, job.incremental_column)
    if candidate is None:
        return job.last_watermark
    if job.last_watermark is None:
        return candidate
    return candidate if _watermark_greater(candidate, job.last_watermark) else job.last_watermark


def fetch_source_rows_result(job: SyncJob) -> SyncFetchResult:
    if not is_sync_fetch_implemented(job.source_type):
        raise RuntimeError(sync_fetch_not_implemented_message(job.source_type))
    mode = resolve_sync_fetch_mode(job.source_type)
    if mode == "sql":
        dialect = resolve_sql_dialect_for_sync(job.source_type)
        return fetch_sql_rows_result(job, dialect)
    if mode == "native":
        return fetch_native_rows_result(job)
    raise RuntimeError(sync_fetch_not_implemented_message(job.source_type))


def fetch_source_rows(job: SyncJob) -> list[dict[str, Any]]:
    return fetch_source_rows_result(job).rows


# 兼容旧导入：等同 fetch_source_rows
def fetch_mysql_rows(job: SyncJob) -> list[dict[str, Any]]:
    return fetch_source_rows(job)
