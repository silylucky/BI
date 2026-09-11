from __future__ import annotations

from typing import Any

from app.core.config import get_settings
from app.datasources.credentials import CredentialDecryptError, decrypt_credential
from app.datasources.registry import ConnectorNotFoundError, registry
from app.ingestion.models import INGESTION_MAX_ROWS, SyncJob, decrypt_password
from app.ingestion.sync_types import SyncFetchResult
from app.ingestion.sync_source_capabilities import resolve_sync_fetch_mode
from app.ingestion.sync_source_table import validate_sync_source_table
from app.query.rls.guard import validate_identifier
from app.query.schemas import QueryError

_SYNC_CONNECT_TIMEOUT_SEC = 5.0


def _sync_read_timeout_sec() -> float:
    settings = get_settings()
    return float(min(max(settings.query_timeout_seconds, 30), 120))


def _connector_kwargs(job: SyncJob) -> dict[str, Any]:
    try:
        password = decrypt_password(job.source_password_encrypted)
    except CredentialDecryptError as exc:
        raise RuntimeError("源连接凭证解密失败") from exc
    return {
        "host": job.source_host,
        "port": job.source_port,
        "database": job.source_database,
        "username": job.source_username,
        "password": password,
        "connect_timeout_sec": _SYNC_CONNECT_TIMEOUT_SEC,
        "read_timeout_sec": _sync_read_timeout_sec(),
    }


def _rows_to_dicts(columns: list[str], rows: list[list]) -> list[dict[str, Any]]:
    return [dict(zip(columns, row, strict=False)) for row in rows]


def fetch_native_rows_result(job: SyncJob) -> SyncFetchResult:
    if job.sync_mode == "incremental":
        raise RuntimeError("增量同步不支持 Native 源，请改用 SQL 表源或切换为全量同步")
    validate_sync_source_table(job.source_type, job.source_table)
    validate_identifier(job.target_table)
    if resolve_sync_fetch_mode(job.source_type) != "native":
        raise RuntimeError(f"未实现的 Native 同步源: {job.source_type}")
    try:
        connector = registry.get(job.source_type)
    except ConnectorNotFoundError as exc:
        raise RuntimeError(f"未知连接器类型: {job.source_type}") from exc
    conn = connector.open_connection(**_connector_kwargs(job))
    try:
        if job.source_type == "mongodb":
            body = {"collection": job.source_table, "database": job.source_database, "filter": {}}
            columns, rows, _ = connector.execute_native_query(
                conn,
                body=body,
                limit=INGESTION_MAX_ROWS,
                offset=0,
                database=job.source_database,
            )
        elif job.source_type in ("csv", "excel"):
            columns, rows, _ = connector.execute_native_query(
                conn,
                body={},
                limit=INGESTION_MAX_ROWS,
                offset=0,
            )
        elif job.source_type == "rest_api":
            path = job.source_table.strip()
            if not path.startswith("/"):
                path = f"/{path}"
            columns, rows, _ = connector.execute_native_query(
                conn,
                body={"path": path},
                limit=INGESTION_MAX_ROWS,
                offset=0,
            )
        elif job.source_type in ("elasticsearch", "opensearch"):
            columns, rows, _ = connector.execute_native_query(
                conn,
                body={},
                index=job.source_table,
                limit=INGESTION_MAX_ROWS,
            )
        elif job.source_type == "influxdb":
            columns, rows, _ = connector.execute_native_query(
                conn,
                body={"measurement": job.source_table, "bucket": job.source_database},
                limit=INGESTION_MAX_ROWS,
                offset=0,
                database=job.source_database,
            )
        else:
            raise RuntimeError(f"未实现的 Native 同步源: {job.source_type}")
        dict_rows = _rows_to_dicts(columns, rows)
        return SyncFetchResult(rows=dict_rows, truncated=len(dict_rows) >= INGESTION_MAX_ROWS)
    except QueryError as exc:
        raise RuntimeError(exc.message) from exc
    finally:
        close = getattr(conn, "close", None)
        if callable(close):
            close()


def fetch_native_rows(job: SyncJob) -> list[dict[str, Any]]:
    return fetch_native_rows_result(job).rows
