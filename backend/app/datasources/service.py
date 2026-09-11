from __future__ import annotations

import hashlib
import inspect
import json
import logging
import threading
import time
import uuid
from datetime import UTC, datetime

from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.models import AuthResourceGrant
from app.core.db.sql_compat import ilike
from app.core.logging import trace_id_var
from app.datasources.acl import apply_list_filter_for_roles, assert_visible
from app.datasources.credentials import CredentialDecryptError, decrypt_credential, encrypt_credential
from app.datasources.models import DataSource, get_meta_session
from app.datasources.pool import pool_manager
from app.datasources.registry import ConnectorNotFoundError, register_usage_checker, registry
from app.datasources.schemas import (
    ConnectionOptions,
    DataSourceCreate,
    DataSourceListResponse,
    DataSourceOut,
    DataSourcePatch,
    DataSourceUpdate,
    TestConnectionIn,
    TestConnectionOut,
)

logger = logging.getLogger("vitalspan.datasources")

_test_inflight: dict[str, float] = {}
_test_lock = threading.Lock()
_INFLIGHT_TTL_SEC = 2.0


class DataSourceError(Exception):
    def __init__(self, code: str, message: str, status: int = 400) -> None:
        self.code = code
        self.message = message
        self.status = status
        super().__init__(message)


def _connection_options_to_json(opts: ConnectionOptions | None) -> dict | None:
    if opts is None:
        return None
    return opts.model_dump(by_alias=False, exclude_none=True)


def _resolve_connection_options(
    *,
    row: DataSource | None = None,
    payload: ConnectionOptions | None = None,
) -> ConnectionOptions:
    if payload is not None:
        return payload
    if row is not None and row.connection_options:
        return ConnectionOptions.model_validate(row.connection_options)
    return ConnectionOptions()


def _to_out(row: DataSource) -> DataSourceOut:
    opts = None
    if row.connection_options is not None:
        opts = ConnectionOptions.model_validate(row.connection_options)
    return DataSourceOut(
        id=row.id,
        name=row.name,
        code=row.code,
        type=row.type,
        host=row.host,
        port=row.port,
        database=row.database,
        username=row.username,
        password="***",
        description=row.description,
        connection_options=opts,
        is_demo_package=is_demo_package_datasource_code(row.code),
    )


def is_demo_package_datasource_code(code: str | None) -> bool:
    return (code or "").lower() == "demo"


def is_managed_analytics_row(row: DataSource) -> bool:
    if (row.code or "").lower() == "analytics":
        return True
    return (
        row.type in ("postgresql", "postgres")
        and row.port == 5433
        and (row.database or "") == "analytics"
    )


def _managed_analytics_clause():
    return or_(
        DataSource.code == "analytics",
        and_(
            DataSource.type.in_(("postgresql", "postgres")),
            DataSource.port == 5433,
            DataSource.database == "analytics",
        ),
    )


def _assert_demo_editable(row: DataSource) -> None:
    if is_demo_package_datasource_code(row.code):
        raise DataSourceError(
            "DATASOURCE_DEMO_PROTECTED",
            "官方示例数据连接不可修改",
            409,
        )
    if is_managed_analytics_row(row):
        raise DataSourceError(
            "DATASOURCE_ANALYTICS_PROTECTED",
            "托管分析库连接不可修改或删除",
            409,
        )


def _resolve_connector(type: str):
    try:
        return registry.get(type)
    except ConnectorNotFoundError as exc:
        raise DataSourceError("UNKNOWN_CONNECTOR_TYPE", f"Unknown connector type: {type}", 422) from exc


def _active_filter(stmt):
    return stmt.where(DataSource.deleted_at.is_(None))


def _count_active_by_type(type: str) -> bool:
    session = get_meta_session()
    try:
        count = session.scalar(
            select(func.count()).select_from(DataSource).where(
                DataSource.type == type, DataSource.deleted_at.is_(None)
            )
        )
        return bool(count and count > 0)
    finally:
        session.close()


register_usage_checker(_count_active_by_type)


def _inflight_key_saved(data_source_id: uuid.UUID) -> str:
    return f"saved:{data_source_id}"


def _inflight_key_draft(payload: TestConnectionIn) -> str:
    raw = json.dumps(payload.model_dump(), sort_keys=True)
    digest = hashlib.sha256(raw.encode()).hexdigest()
    return f"draft:{digest}"


def _release_test_slot(key: str) -> None:
    with _test_lock:
        _test_inflight.pop(key, None)


def _acquire_test_slot(key: str) -> None:
    now = time.monotonic()
    with _test_lock:
        expired = [k for k, exp in _test_inflight.items() if exp <= now]
        for k in expired:
            del _test_inflight[k]
        expires = _test_inflight.get(key)
        if expires is not None and expires > now:
            raise DataSourceError("TEST_IN_PROGRESS", "Connection test already in progress", 429)
        _test_inflight[key] = now + _INFLIGHT_TTL_SEC


_CONNECTOR_TYPES_NEED_OPTIONS = frozenset({"trino", "presto", "rest_api"})


def _build_test_connection_kwargs(
    connector,
    *,
    host: str,
    port: int,
    database: str,
    username: str,
    password: str,
    options: ConnectionOptions | None = None,
) -> dict:
    opts = options or ConnectionOptions()
    kwargs = {
        "host": host,
        "port": port,
        "database": database,
        "username": username,
        "password": password,
        "timeout_sec": opts.connect_timeout_sec,
        "charset": opts.charset,
        "collation": opts.collation,
        "ssl_mode": opts.ssl_mode,
        "connect_timeout_sec": opts.connect_timeout_sec,
        "read_timeout_sec": opts.read_timeout_sec,
    }
    params = inspect.signature(connector.test_connection).parameters
    has_var_kw = any(p.kind == inspect.Parameter.VAR_KEYWORD for p in params.values())
    if "connection_options" in params:
        kwargs["connection_options"] = _connection_options_to_json(opts)
    elif has_var_kw and connector.type in _CONNECTOR_TYPES_NEED_OPTIONS:
        kwargs["connection_options"] = _connection_options_to_json(opts)
    if has_var_kw:
        allowed = {
            "host",
            "port",
            "database",
            "username",
            "password",
            "timeout_sec",
            "charset",
            "collation",
            "ssl_mode",
            "connect_timeout_sec",
            "read_timeout_sec",
        }
        if connector.type in _CONNECTOR_TYPES_NEED_OPTIONS:
            allowed.add("connection_options")
        kwargs = {k: v for k, v in kwargs.items() if k in allowed}
    else:
        kwargs = {k: v for k, v in kwargs.items() if k in params}
    return kwargs


def _run_test(
    connector,
    *,
    host: str,
    port: int,
    database: str,
    username: str,
    password: str,
    options: ConnectionOptions | None = None,
    data_source_id: uuid.UUID | None = None,
) -> TestConnectionOut:
    result = connector.test_connection(
        **_build_test_connection_kwargs(
            connector,
            host=host,
            port=port,
            database=database,
            username=username,
            password=password,
            options=options,
        )
    )
    trace = trace_id_var.get() or ""
    out = TestConnectionOut.from_result(result, trace_id=trace)
    extra: dict = {"traceId": trace, "ok": result.ok}
    if data_source_id is not None:
        extra["dataSourceId"] = str(data_source_id)
        if result.ok:
            pool_manager.evict_pool(data_source_id)
    logger.info("datasource_test", extra=extra)
    return out


def list_data_sources(
    session: Session,
    *,
    role_codes: list[str],
    is_root: bool = False,
    limit: int = 50,
    offset: int = 0,
    type: str | None = None,
    q: str | None = None,
    include_managed: bool = False,
) -> DataSourceListResponse:
    limit = max(1, min(limit, 100))
    offset = max(0, offset)
    base = select(DataSource)
    base = _active_filter(base)
    base = apply_list_filter_for_roles(base, session, role_codes, is_root=is_root)
    if type:
        base = base.where(DataSource.type == type)
    if q:
        pattern = f"%{q}%"
        base = base.where(or_(ilike(DataSource.name, pattern), ilike(DataSource.code, pattern)))
    if not include_managed:
        base = base.where(~_managed_analytics_clause())
    count_stmt = select(func.count()).select_from(DataSource)
    count_stmt = _active_filter(count_stmt)
    count_stmt = apply_list_filter_for_roles(count_stmt, session, role_codes, is_root=is_root)
    if type:
        count_stmt = count_stmt.where(DataSource.type == type)
    if q:
        pattern = f"%{q}%"
        count_stmt = count_stmt.where(or_(ilike(DataSource.name, pattern), ilike(DataSource.code, pattern)))
    if not include_managed:
        count_stmt = count_stmt.where(~_managed_analytics_clause())
    total = session.scalar(count_stmt) or 0
    rows = list(session.scalars(base.order_by(DataSource.code).limit(limit).offset(offset)))
    return DataSourceListResponse(
        items=[_to_out(row) for row in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


def create_data_source(session: Session, payload: DataSourceCreate) -> DataSourceOut:
    _resolve_connector(payload.type)
    existing_code = session.scalar(
        select(DataSource).where(DataSource.code == payload.code, DataSource.deleted_at.is_(None))
    )
    if existing_code is not None:
        raise DataSourceError("DATASOURCE_CODE_CONFLICT", "Data source code already exists", 409)
    existing_name = session.scalar(
        select(DataSource).where(DataSource.name == payload.name, DataSource.deleted_at.is_(None))
    )
    if existing_name is not None:
        raise DataSourceError("DATASOURCE_NAME_CONFLICT", "Data source name already exists", 409)
    row = DataSource(
        name=payload.name,
        code=payload.code,
        type=payload.type,
        host=payload.host,
        port=payload.port,
        database=payload.database,
        username=payload.username,
        password_encrypted=encrypt_credential(payload.password),
        description=payload.description,
        connection_options=_connection_options_to_json(payload.connection_options),
    )
    session.add(row)
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        message = str(exc.orig).lower() if exc.orig else ""
        if "code" in message:
            raise DataSourceError("DATASOURCE_CODE_CONFLICT", "Data source code already exists", 409) from exc
        raise DataSourceError("DATASOURCE_NAME_CONFLICT", "Data source name already exists", 409) from exc
    session.refresh(row)
    return _to_out(row)


def get_data_source(
    session: Session, data_source_id: uuid.UUID, *, role_codes: list[str], is_root: bool = False,
) -> DataSourceOut:
    assert_visible(session, role_codes, data_source_id, is_root=is_root)
    row = session.get(DataSource, data_source_id)
    if row is None or row.deleted_at is not None:
        raise DataSourceError("DATASOURCE_NOT_FOUND", "Data source not found", 404)
    return _to_out(row)


def update_data_source(
    session: Session,
    data_source_id: uuid.UUID,
    payload: DataSourceUpdate,
    *,
    role_codes: list[str],
    is_root: bool = False,
) -> DataSourceOut:
    assert_visible(session, role_codes, data_source_id, is_root=is_root)
    row = session.get(DataSource, data_source_id)
    if row is None or row.deleted_at is not None:
        raise DataSourceError("DATASOURCE_NOT_FOUND", "Data source not found", 404)
    _assert_demo_editable(row)
    row.name = payload.name
    row.host = payload.host
    row.port = payload.port
    row.database = payload.database
    row.username = payload.username
    if payload.password:
        row.password_encrypted = encrypt_credential(payload.password)
    row.description = payload.description
    if payload.connection_options is not None:
        row.connection_options = _connection_options_to_json(payload.connection_options)
    existing_name = session.scalar(
        select(DataSource).where(
            DataSource.name == payload.name,
            DataSource.id != data_source_id,
            DataSource.deleted_at.is_(None),
        )
    )
    if existing_name is not None:
        raise DataSourceError("DATASOURCE_NAME_CONFLICT", "Data source name already exists", 409)
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise DataSourceError("DATASOURCE_NAME_CONFLICT", "Data source name already exists", 409) from exc
    session.refresh(row)
    return _to_out(row)


def patch_data_source(
    session: Session,
    data_source_id: uuid.UUID,
    payload: DataSourcePatch,
    *,
    role_codes: list[str],
    is_root: bool = False,
) -> DataSourceOut:
    assert_visible(session, role_codes, data_source_id, is_root=is_root)
    row = session.get(DataSource, data_source_id)
    if row is None or row.deleted_at is not None:
        raise DataSourceError("DATASOURCE_NOT_FOUND", "Data source not found", 404)
    _assert_demo_editable(row)
    data = payload.model_dump(exclude_unset=True, by_alias=False)
    if "connection_options" in data:
        raw = data.pop("connection_options")
        row.connection_options = _connection_options_to_json(
            ConnectionOptions.model_validate(raw) if raw is not None else None
        )
    if "name" in data and data["name"] != row.name:
        conflict = session.scalar(
            select(DataSource).where(
                DataSource.name == data["name"],
                DataSource.id != data_source_id,
                DataSource.deleted_at.is_(None),
            )
        )
        if conflict:
            raise DataSourceError("DATASOURCE_NAME_CONFLICT", "Data source name already exists", 409)
    for field, value in data.items():
        if field == "password" and value:
            row.password_encrypted = encrypt_credential(value)
        elif field != "password" and value is not None:
            setattr(row, field, value)
    session.commit()
    session.refresh(row)
    return _to_out(row)


def delete_data_source(
    session: Session, data_source_id: uuid.UUID, *, role_codes: list[str], is_root: bool = False,
) -> None:
    assert_visible(session, role_codes, data_source_id, is_root=is_root)
    row = session.get(DataSource, data_source_id)
    if row is None or row.deleted_at is not None:
        raise DataSourceError("DATASOURCE_NOT_FOUND", "Data source not found", 404)
    if is_demo_package_datasource_code(row.code):
        raise DataSourceError(
            "DATASOURCE_DEMO_PROTECTED",
            "官方示例数据连接不可删除",
            409,
        )
    if is_managed_analytics_row(row):
        raise DataSourceError(
            "DATASOURCE_ANALYTICS_PROTECTED",
            "托管分析库连接不可修改或删除",
            409,
        )
    from app.ingestion.models import SyncJob
    from app.metadata.dataset.models import DatasetRecord
    from app.query.config_store.models import QueryConfigRecord

    sync_ref = session.scalar(
        select(SyncJob.id).where(SyncJob.source_data_source_id == data_source_id).limit(1),
    )
    if sync_ref is not None:
        raise DataSourceError(
            "DATASOURCE_IN_USE",
            "Data source is referenced by sync jobs",
            409,
        )
    dataset_ref = session.scalar(
        select(DatasetRecord.dataset_id)
        .where(DatasetRecord.table_source_datasource_id == data_source_id)
        .limit(1),
    )
    if dataset_ref is not None:
        raise DataSourceError(
            "DATASOURCE_IN_USE",
            "Data source is referenced by datasets",
            409,
        )
    ds_id_str = str(data_source_id)
    bound_ref = session.scalar(
        select(QueryConfigRecord.id)
        .where(
            QueryConfigRecord.config_type == "dataset_query",
            QueryConfigRecord.payload["dataSourceId"].as_string() == ds_id_str,
        )
        .limit(1),
    )
    if bound_ref is not None:
        raise DataSourceError(
            "DATASOURCE_IN_USE",
            "Data source is referenced by dataset query bindings",
            409,
        )
    from app.auth.cleanup import purge_datasource_scope_metadata, purge_grants_for_resource

    purge_grants_for_resource(
        session,
        resource_type="datasource",
        resource_id=data_source_id,
    )
    purge_datasource_scope_metadata(session, data_source_id)
    row.deleted_at = datetime.now(UTC)
    session.commit()
    pool_manager.evict_pool(data_source_id)


def test_connection_draft(payload: TestConnectionIn) -> TestConnectionOut:
    key = _inflight_key_draft(payload)
    _acquire_test_slot(key)
    try:
        connector = _resolve_connector(payload.type)
        return _run_test(
            connector,
            host=payload.host,
            port=payload.port,
            database=payload.database,
            username=payload.username,
            password=payload.password,
            options=payload.connection_options,
        )
    finally:
        _release_test_slot(key)


def test_connection_by_id(
    session: Session, data_source_id: uuid.UUID, *, role_codes: list[str], is_root: bool = False,
) -> TestConnectionOut:
    assert_visible(session, role_codes, data_source_id, is_root=is_root)
    key = _inflight_key_saved(data_source_id)
    _acquire_test_slot(key)
    try:
        row = session.get(DataSource, data_source_id)
        if row is None or row.deleted_at is not None:
            raise DataSourceError("DATASOURCE_NOT_FOUND", "Data source not found", 404)
        connector = _resolve_connector(row.type)
        try:
            password = decrypt_credential(row.password_encrypted)
        except CredentialDecryptError as exc:
            raise DataSourceError("CREDENTIAL_DECRYPT_FAILED", str(exc), 500) from exc
        return _run_test(
            connector,
            host=row.host,
            port=row.port,
            database=row.database,
            username=row.username,
            password=password,
            options=_resolve_connection_options(row=row),
            data_source_id=data_source_id,
        )
    finally:
        _release_test_slot(key)
