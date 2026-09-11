from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.auth.resources.service import VisibilityError
from app.datasources.acl import assert_visible
from app.datasources.credentials import CredentialDecryptError, decrypt_credential
from app.datasources.models import DataSource
from app.datasources.pool import pool_manager
from app.datasources.registry import ConnectorNotFoundError, registry
from app.datasources.service import _resolve_connection_options
from app.query.capabilities import NATIVE_OFFSET_TYPES, NATIVE_QUERY_CAPABLE
from app.query.executor import QueryResult, _serialize_cell
from app.query.native.guard import resolve_query_mode, validate_native_spec
from app.query.native.schemas import NativeQuerySpec
from app.query.schemas import QueryError

_SUPPORTED_NATIVE_TYPES = NATIVE_QUERY_CAPABLE


class NativeQueryExecutor:
    def execute(
        self,
        session: Session,
        user: UserContext,
        data_source_id: uuid.UUID,
        *,
        body: dict,
        index: str | None,
        limit: int,
        offset: int = 0,
    ) -> QueryResult:
        row = self._load_row(session, data_source_id)
        try:
            assert_visible(session, user.roles, data_source_id, is_root=user.is_root)
        except VisibilityError as exc:
            raise QueryError(exc.code, exc.message, exc.status) from exc

        if resolve_query_mode(row.type) != "native":
            raise QueryError("QUERY_NATIVE_WRONG_MODE", f"{row.type} requires sql mode", 422)

        spec = NativeQuerySpec(connector_type=row.type, body=body, index=index)
        validate_native_spec(spec)

        if row.type in ("elasticsearch", "opensearch") and offset > 0:
            raise QueryError(
                "QUERY_NATIVE_OFFSET_UNSUPPORTED",
                "offset is not supported for search connectors",
                422,
            )

        if row.type not in _SUPPORTED_NATIVE_TYPES:
            raise QueryError(
                "QUERY_NATIVE_EXECUTE_UNSUPPORTED",
                f"Native execute not implemented for {row.type}",
                422,
            )

        connector, kwargs, pool_size = self._connector_kwargs(row)
        try:
            with pool_manager.pooled_connection(
                data_source_id,
                connector=connector,
                connect_kwargs=kwargs,
                pool_size=pool_size,
            ) as conn:
                columns, rows, truncated = self._run_native_query(
                    connector,
                    row,
                    conn,
                    body=body,
                    index=index,
                    limit=limit,
                    offset=offset,
                )
        except QueryError:
            raise
        except Exception as exc:
            raise QueryError("QUERY_EXECUTION_ERROR", str(exc), 400) from exc

        serialized = [[_serialize_cell(c) for c in r] for r in rows]
        return QueryResult(
            columns=columns,
            rows=serialized,
            row_count=len(serialized),
            truncated=truncated,
        )

    def _load_row(self, session: Session, data_source_id: uuid.UUID) -> DataSource:
        row = session.get(DataSource, data_source_id)
        if row is None or row.deleted_at is not None:
            raise QueryError("DATASOURCE_NOT_FOUND", "Data source not found", 404)
        return row

    def _connector_kwargs(self, row: DataSource):
        try:
            connector = registry.get(row.type)
        except ConnectorNotFoundError as exc:
            raise QueryError("UNKNOWN_CONNECTOR_TYPE", str(exc), 422) from exc
        try:
            password = decrypt_credential(row.password_encrypted)
        except CredentialDecryptError as exc:
            raise QueryError("CREDENTIAL_DECRYPT_FAILED", str(exc), 500) from exc
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
        return connector, kwargs, opts.pool_size

    @staticmethod
    def _run_native_query(
        connector,
        row: DataSource,
        conn,
        *,
        body: dict,
        index: str | None,
        limit: int,
        offset: int,
    ) -> tuple[list[str], list[list], bool]:
        if row.type == "mongodb":
            return connector.execute_native_query(
                conn, body=body, limit=limit, offset=offset, database=row.database,
            )
        if row.type in NATIVE_OFFSET_TYPES:
            return connector.execute_native_query(
                conn, body=body, limit=limit, offset=offset,
            )
        return connector.execute_native_query(
            conn, body=body, index=index, limit=limit,
        )
