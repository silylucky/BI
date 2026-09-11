from __future__ import annotations

from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.auth.resources.service import VisibilityError
from app.auth.rls.predicate import RlsConfigError
from app.core.config import get_settings
from app.core.logging import trace_id_var
from app.datasources.acl import assert_visible
from app.query.dataset.pandas_transform import apply_pandas_to_query_result
from app.query.executor import QueryExecutor
from app.query.native.executor import NativeQueryExecutor
from app.query.schemas import ExecuteRequest, ExecuteResponse, QueryError


_executor = QueryExecutor()
_native_executor = NativeQueryExecutor()


def _effective_limit(request: ExecuteRequest, binding_default: int | None = None) -> int:
    settings = get_settings()
    if request.limit is not None:
        return min(request.limit, settings.query_default_limit)
    if binding_default is not None:
        return min(binding_default, settings.query_default_limit)
    return settings.query_default_limit


def _rls_enabled(request: ExecuteRequest) -> bool:
    if request.rls.enabled:
        return True
    if get_settings().vitalspan_env != "development":
        raise QueryError("RLS_CONFIG_INVALID", "Disabling RLS is only allowed in development", 400)
    return False


def execute_query(session: Session, user: UserContext, payload: ExecuteRequest) -> ExecuteResponse:
    from app.query.binding_service import resolve_binding_execute

    if payload.binding_id is not None:
        resolved = resolve_binding_execute(session, user.roles, payload.binding_id, is_root=user.is_root)
        data_source_id = resolved["data_source_id"]
        mode = resolved["mode"]
        sql = resolved.get("sql")
        schema = resolved.get("schema_name")
        table = resolved.get("table_name")
        limit = _effective_limit(payload, resolved.get("default_limit"))
    else:
        data_source_id = payload.data_source_id  # type: ignore[assignment]
        mode = payload.mode  # type: ignore[assignment]
        sql = payload.sql
        schema = payload.schema
        table = payload.table
        limit = _effective_limit(payload)
        if mode == "native" and (payload.sql or payload.schema or payload.table):
            raise QueryError(
                "QUERY_NATIVE_SQL_DISGUISE",
                "sql/schema/table fields are not allowed in native mode",
                422,
            )

    try:
        assert_visible(session, user.roles, data_source_id, is_root=user.is_root)
    except VisibilityError as exc:
        raise QueryError(exc.code, exc.message, exc.status) from exc

    apply_rls = _rls_enabled(payload)
    rls_config = {
        "table_alias": payload.rls.table_alias,
        "org_column": payload.rls.org_column,
        "region_column": payload.rls.region_column,
    }
    table_name_for_rls = table if mode == "table" else None
    from app.auth.rls.resolve_config import enrich_rls_config

    rls_config = enrich_rls_config(
        session,
        rls_config,
        datasource_id=data_source_id,
        dataset_id=None,
        table_name=table_name_for_rls,
    )
    try:
        if mode == "sql":
            result = _executor.execute_sql(
                session, user, data_source_id, sql or "", limit=limit, offset=payload.offset,
                rls_config=rls_config, apply_rls=apply_rls,
            )
        elif mode == "table":
            result = _executor.execute_table(
                session, user, data_source_id, schema or "", table or "",
                limit=limit, offset=payload.offset, rls_config=rls_config, apply_rls=apply_rls,
            )
        else:
            if apply_rls:
                raise QueryError(
                    "QUERY_NATIVE_RLS_UNSUPPORTED",
                    "Row-level security is not supported for native query mode",
                    422,
                )
            result = _native_executor.execute(
                session,
                user,
                data_source_id,  # type: ignore[arg-type]
                body=payload.native_body or {},
                index=payload.index,
                limit=limit,
                offset=payload.offset,
            )
    except RlsConfigError as exc:
        raise QueryError("RLS_CONFIG_INVALID", str(exc), 400) from exc

    result = apply_pandas_to_query_result(result)

    from app.auth.masking.service import apply_masks_to_result

    table_name = table if mode == "table" else None
    masked_cols, masked_rows = apply_masks_to_result(
        session,
        columns=result.columns,
        rows=result.rows,
        datasource_id=data_source_id,
        table_name=table_name,
    )

    return ExecuteResponse(
        columns=masked_cols,
        rows=masked_rows,
        row_count=result.row_count,
        truncated=result.truncated,
        trace_id=trace_id_var.get() or "",
    )
