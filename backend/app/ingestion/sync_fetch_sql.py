from __future__ import annotations

from typing import Any

from app.core.config import get_settings
from app.datasources.registry import ConnectorNotFoundError, registry
from app.ingestion.models import INGESTION_MAX_ROWS, SyncJob, decrypt_password
from app.ingestion.sync_types import SyncFetchResult
from app.ingestion.sync_sql_builder import build_sync_select
from app.query.capabilities import resolve_sql_dialect_type
from app.query.rls.guard import validate_identifier

_SYNC_CONNECT_TIMEOUT_SEC = 5.0


def _sync_read_timeout_sec() -> float:
    settings = get_settings()
    return float(min(max(settings.query_timeout_seconds, 30), 120))


def _validate_sync_table_names(source_table: str, target_table: str) -> None:
    validate_identifier(source_table)
    validate_identifier(target_table)


def _connector_kwargs(job: SyncJob) -> dict[str, Any]:
    return {
        "host": job.source_host,
        "port": job.source_port,
        "database": job.source_database,
        "username": job.source_username,
        "password": decrypt_password(job.source_password_encrypted),
        "connect_timeout_sec": _SYNC_CONNECT_TIMEOUT_SEC,
        "read_timeout_sec": _sync_read_timeout_sec(),
    }


def _cursor_rows(cursor: Any) -> list[dict[str, Any]]:
    columns = [col[0] for col in cursor.description]
    return [dict(zip(columns, row, strict=False)) for row in cursor.fetchall()]


def _fetch_registry_cursor_rows(
    job: SyncJob,
    connector_type: str,
    dialect_type: str,
) -> list[dict[str, Any]]:
    try:
        connector = registry.get(connector_type)
    except ConnectorNotFoundError as exc:
        raise RuntimeError(f"未知连接器类型: {connector_type}") from exc
    sql, params = build_sync_select(job, dialect_type)
    conn = connector.open_connection(**_connector_kwargs(job))
    try:
        if connector_type == "clickhouse":
            result = conn.query(sql, parameters=list(params)) if params else conn.query(sql)
            if hasattr(result, "named_results"):
                return list(result.named_results())
            columns = result.column_names
            return [dict(zip(columns, row, strict=False)) for row in result.result_rows]
        if connector_type == "sqlite":
            cur = conn.execute(sql.replace("%s", "?"), params)
            if cur.description is None:
                return []
            columns = [col[0] for col in cur.description]
            return [dict(zip(columns, row, strict=False)) for row in cur.fetchall()]
        cursor = conn.cursor()
        cursor.execute(sql, params)
        return _cursor_rows(cursor)
    finally:
        close = getattr(conn, "close", None)
        if callable(close):
            close()


def _fetch_mysql_dialect_rows(job: SyncJob) -> list[dict[str, Any]]:
    return _fetch_registry_cursor_rows(job, job.source_type, "mysql")


def _fetch_postgresql_rows(job: SyncJob) -> list[dict[str, Any]]:
    return _fetch_registry_cursor_rows(job, job.source_type, "postgresql")


def fetch_sql_rows_result(job: SyncJob, dialect: str) -> SyncFetchResult:
    rows = fetch_sql_rows(job, dialect)
    return SyncFetchResult(rows=rows, truncated=len(rows) >= INGESTION_MAX_ROWS)


def fetch_sql_rows(job: SyncJob, dialect: str) -> list[dict[str, Any]]:
    _validate_sync_table_names(job.source_table, job.target_table)
    resolved = resolve_sql_dialect_type(job.source_type)
    if dialect in ("mysql", "postgresql") and resolved == dialect:
        return _fetch_registry_cursor_rows(job, job.source_type, dialect)
    supported = {
        "mysql",
        "postgresql",
        "clickhouse",
        "oracle",
        "sqlserver",
        "sqlite",
        "hive",
        "trino",
        "db2",
        "tdengine",
    }
    if dialect not in supported:
        raise RuntimeError(f"未实现的 SQL 方言拉数: {dialect}")
    connector_type = resolve_sql_dialect_type(job.source_type)
    return _fetch_registry_cursor_rows(job, connector_type, dialect)
