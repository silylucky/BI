from __future__ import annotations

import inspect
import uuid

from contextlib import contextmanager
from collections.abc import Iterator
from typing import Any

from sqlalchemy.orm import Session

from app.datasources.acl import assert_visible
from app.datasources.credentials import CredentialDecryptError, decrypt_credential
from app.datasources.models import DataSource
from app.datasources.registry import ConnectorNotFoundError, registry
from app.datasources.schemas import (
    ColumnItemOut,
    ColumnListResponse,
    SchemaItemOut,
    SchemaListResponse,
    TableItemOut,
    TableListResponse,
)
from app.datasources.service import DataSourceError, _resolve_connection_options


def _load_row(session: Session, data_source_id: uuid.UUID) -> DataSource:
    row = session.get(DataSource, data_source_id)
    if row is None or row.deleted_at is not None:
        raise DataSourceError("DATASOURCE_NOT_FOUND", "Data source not found", 404)
    return row


def _connector_and_kwargs(row: DataSource) -> tuple:
    try:
        connector = registry.get(row.type)
    except ConnectorNotFoundError as exc:
        raise DataSourceError("UNKNOWN_CONNECTOR_TYPE", f"Unknown connector type: {row.type}", 422) from exc
    if "schema_browser" not in connector.capabilities:
        raise DataSourceError("METADATA_NOT_SUPPORTED", "Connector does not support schema browsing", 422)
    try:
        password = decrypt_credential(row.password_encrypted)
    except CredentialDecryptError as exc:
        raise DataSourceError("CREDENTIAL_DECRYPT_FAILED", str(exc), 500) from exc
    opts = _resolve_connection_options(row=row)
    kwargs = {
        "host": row.host,
        "port": row.port,
        "database": row.database,
        "username": row.username,
        "password": password,
        "connect_timeout_sec": opts.connect_timeout_sec,
        "ssl_mode": opts.ssl_mode,
    }
    return connector, kwargs


@contextmanager
def _metadata_connection(connector, kwargs: dict[str, Any]) -> Iterator[Any]:
    """元数据浏览使用短连接，避免跨线程复用 psycopg 连接导致挂起。"""
    conn = connector.open_connection(**kwargs)
    try:
        yield conn
    finally:
        try:
            conn.close()
        except Exception:
            pass


def _map_metadata_error(exc: Exception) -> DataSourceError:
    msg = str(exc)
    if "pool exhausted" in msg.lower():
        return DataSourceError(
            "METADATA_POOL_EXHAUSTED",
            "数据源连接池繁忙，请稍后重试或先测试连接",
            503,
        )
    if "timeout" in msg.lower():
        return DataSourceError("METADATA_TIMEOUT", msg, 504)
    return DataSourceError("METADATA_CONNECTION_FAILED", msg or "无法连接数据源", 502)


def _catalog_kwargs(row: DataSource) -> dict[str, str]:
    if row.type in ("trino", "presto") and row.database:
        return {"catalog": row.database}
    return {}


def _call_metadata(connector, method_name: str, conn, *args, row: DataSource):
    method = getattr(connector, method_name)
    extra = _catalog_kwargs(row)
    if extra:
        params = inspect.signature(method).parameters
        if "catalog" in params or row.type in ("trino", "presto"):
            return method(conn, *args, **extra)
    return method(conn, *args)


def list_schemas(
    session: Session,
    role_codes: list[str],
    data_source_id: uuid.UUID,
    *,
    is_root: bool = False,
) -> SchemaListResponse:
    assert_visible(session, role_codes, data_source_id, is_root=is_root)
    row = _load_row(session, data_source_id)
    connector, kwargs = _connector_and_kwargs(row)
    try:
        with _metadata_connection(connector, kwargs) as conn:
            items = _call_metadata(connector, "list_schemas", conn, row=row)
    except DataSourceError:
        raise
    except Exception as exc:
        raise _map_metadata_error(exc) from exc
    return SchemaListResponse(items=[SchemaItemOut(name=i.name) for i in items])


def list_tables(
    session: Session,
    role_codes: list[str],
    data_source_id: uuid.UUID,
    schema: str,
    *,
    is_root: bool = False,
) -> TableListResponse:
    if not schema:
        raise DataSourceError("METADATA_INVALID_REQUEST", "schema query parameter is required", 400)
    assert_visible(session, role_codes, data_source_id, is_root=is_root)
    row = _load_row(session, data_source_id)
    connector, kwargs = _connector_and_kwargs(row)
    try:
        with _metadata_connection(connector, kwargs) as conn:
            items = _call_metadata(connector, "list_tables", conn, schema, row=row)
    except DataSourceError:
        raise
    except Exception as exc:
        raise _map_metadata_error(exc) from exc
    return TableListResponse(items=[TableItemOut(name=i.name, type=i.type) for i in items])


def list_columns(
    session: Session,
    role_codes: list[str],
    data_source_id: uuid.UUID,
    schema: str,
    table: str,
    *,
    is_root: bool = False,
) -> ColumnListResponse:
    if not schema or not table:
        raise DataSourceError("METADATA_INVALID_REQUEST", "schema and table query parameters are required", 400)
    assert_visible(session, role_codes, data_source_id, is_root=is_root)
    row = _load_row(session, data_source_id)
    connector, kwargs = _connector_and_kwargs(row)
    try:
        with _metadata_connection(connector, kwargs) as conn:
            items = _call_metadata(connector, "list_columns", conn, schema, table, row=row)
    except DataSourceError:
        raise
    except Exception as exc:
        raise _map_metadata_error(exc) from exc
    return ColumnListResponse(
        items=[ColumnItemOut(name=i.name, data_type=i.data_type, nullable=i.nullable) for i in items]
    )
