from __future__ import annotations

import time
from typing import Any
from urllib.parse import quote

import httpx

from app.datasources.dialects.base import ColumnInfo, SchemaInfo, TableInfo, TestConnectionResult
from app.datasources.dialects.errors import (
    ROAPI_AUTH_FAILED,
    ROAPI_INVALID_URL,
    ROAPI_PROBE_FAILED,
    ROAPI_QUERY_FAILED,
    ROAPI_TABLE_NOT_FOUND,
    map_roapi_error,
)
from app.datasources.dialects import roapi_support as support
from app.query.native.guard import guard_native_injection
from app.query.readonly import assert_readonly_sql
from app.query.schemas import QueryError


def probe_readonly_fetch(client: httpx.Client) -> bool:
    path = support.schema_path_from_client(client)
    try:
        resp = client.get(path, timeout=5.0)
        return resp.is_success
    except Exception:
        return False


class RoapiConnector:
    type = "roapi"
    category = "api"
    capabilities = ("connectivity_test", "schema_browser", "native_query")
    display_name = "RoAPI"

    def _client(self, **kwargs: Any) -> httpx.Client:
        cfg = support.client_kwargs(kwargs)
        client = httpx.Client(
            base_url=cfg["base_url"],
            headers=cfg["headers"],
            auth=cfg["auth"],
            timeout=cfg["timeout"],
            follow_redirects=True,
        )
        client._vs_roapi_schema_path = support.resolve_schema_path(kwargs.get("database"))
        return client

    def test_connection(self, **kwargs: Any) -> TestConnectionResult:
        started = time.perf_counter()
        try:
            support.validate_base_url(kwargs["host"], int(kwargs.get("port", support.ROAPI_DEFAULT_PORT)))
            schema_path = support.resolve_schema_path(kwargs.get("database"))
            with self._client(**kwargs) as client:
                support.request_json(client, "GET", schema_path)
            ok, code, detail = True, None, "Connection successful"
        except QueryError as exc:
            ok, code, detail = False, exc.code, exc.message
        except Exception as exc:
            code, detail = map_roapi_error(exc)
            if "missing scheme" in str(exc).lower():
                code = ROAPI_INVALID_URL
            ok = False
        latency_ms = int((time.perf_counter() - started) * 1000)
        if ok:
            return TestConnectionResult(ok=True, message=detail, latency_ms=latency_ms, code=None)
        return TestConnectionResult(ok=False, message=f"[{code}] {detail}", latency_ms=latency_ms, code=code)

    def open_connection(self, **kwargs: Any) -> httpx.Client:
        return self._client(**kwargs)

    def list_schemas(self, connection: httpx.Client) -> list[SchemaInfo]:
        return [SchemaInfo(name="roapi")]

    def list_tables(self, connection: httpx.Client, schema: str) -> list[TableInfo]:
        schema_path = support.schema_path_from_client(connection)
        payload = support.request_json(connection, "GET", schema_path)
        return [TableInfo(name=name, type="TABLE") for name in support.table_names(payload)]

    def list_columns(self, connection: httpx.Client, schema: str, table: str) -> list[ColumnInfo]:
        schema_path = support.schema_path_from_client(connection)
        payload = support.request_json(connection, "GET", schema_path)
        columns = support.columns_for_table(payload, table)
        if columns:
            return columns
        raise QueryError(ROAPI_TABLE_NOT_FOUND, f"Table not found: {table}", 404)

    def execute_native_query(
        self,
        connection: httpx.Client,
        *,
        body: dict,
        limit: int,
        offset: int = 0,
        database: str | None = None,
    ) -> tuple[list[str], list[list], bool]:
        guard_native_injection(body)
        sql = body.get("sql")
        if isinstance(sql, str) and sql.strip():
            assert_readonly_sql(sql)
            query = support.apply_limit_offset(sql, limit=limit, offset=offset)
            resp = connection.post(support.ROAPI_SQL_PATH, content=query)
            if resp.status_code == 401:
                raise QueryError(ROAPI_AUTH_FAILED, "Unauthorized", 401)
            if not resp.is_success:
                raise QueryError(ROAPI_QUERY_FAILED, f"SQL query failed: HTTP {resp.status_code}", 400)
            payload = resp.json() if resp.content else []
            return support.payload_to_rows(payload, limit=limit, offset=0)
        table = body.get("table")
        if not isinstance(table, str) or not table.strip():
            raise QueryError("QUERY_NATIVE_INVALID_BODY", "body.sql or body.table is required", 422)
        params: dict[str, str | int] = {"limit": limit + offset}
        columns_filter = body.get("columns")
        if isinstance(columns_filter, str) and columns_filter.strip():
            params["columns"] = columns_filter.strip()
        path = f"/api/tables/{quote(table.strip(), safe='')}"
        resp = connection.get(path, params=params)
        if resp.status_code == 401:
            raise QueryError(ROAPI_AUTH_FAILED, "Unauthorized", 401)
        if resp.status_code == 404:
            raise QueryError(ROAPI_TABLE_NOT_FOUND, f"Table not found: {table}", 404)
        if not resp.is_success:
            raise QueryError(ROAPI_PROBE_FAILED, f"HTTP {resp.status_code}", 400)
        payload = resp.json() if resp.content else []
        return support.payload_to_rows(payload, limit=limit, offset=offset)
