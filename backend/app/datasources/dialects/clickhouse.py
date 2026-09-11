from __future__ import annotations

import time
from typing import Any

from app.datasources.dialects.base import ColumnInfo, SchemaInfo, TableInfo, TestConnectionResult
from app.datasources.dialects.errors import map_clickhouse_error

CLICKHOUSE_MAX_COLUMNS = 500

_SYSTEM_DATABASES = frozenset({"system", "INFORMATION_SCHEMA"})


class ClickhouseConnector:
    type = "clickhouse"
    category = "olap"
    capabilities = ("connectivity_test", "schema_browser")
    display_name = "ClickHouse"

    def _client(self, **kwargs: Any) -> Any:
        import clickhouse_connect

        return clickhouse_connect.get_client(
            host=kwargs["host"],
            port=kwargs.get("port", 8123),
            username=kwargs["username"],
            password=kwargs["password"],
            database=kwargs.get("database") or "default",
        )

    def open_connection(self, **kwargs: Any) -> Any:
        return self._client(**kwargs)

    def test_connection(self, **kwargs: Any) -> TestConnectionResult:
        started = time.perf_counter()
        try:
            client = self._client(**kwargs)
            client.command("SELECT 1")
        except Exception as exc:
            code, detail = map_clickhouse_error(exc)
            latency_ms = int((time.perf_counter() - started) * 1000)
            return TestConnectionResult(
                ok=False,
                message=f"[{code}] {detail}",
                latency_ms=latency_ms,
                code=code,
            )
        latency_ms = int((time.perf_counter() - started) * 1000)
        return TestConnectionResult(ok=True, message="Connection successful", latency_ms=latency_ms, code=None)

    def list_schemas(self, connection: Any) -> list[SchemaInfo]:
        rows = connection.query(
            "SELECT name FROM system.databases WHERE name NOT IN ('system','INFORMATION_SCHEMA')"
        ).result_rows
        return [SchemaInfo(name=row[0]) for row in rows if row]

    def list_tables(self, connection: Any, schema: str) -> list[TableInfo]:
        if not schema.strip():
            return []
        rows = connection.query(
            "SELECT name, engine FROM system.tables WHERE database = {db:String}",
            parameters={"db": schema},
        ).result_rows
        return [TableInfo(name=row[0], type=row[1] or "TABLE") for row in rows if row]

    def list_columns(self, connection: Any, schema: str, table: str) -> list[ColumnInfo]:
        if not schema.strip() or not table.strip():
            return []
        rows = connection.query(
            "SELECT name, type FROM system.columns WHERE database = {db:String} AND table = {tbl:String}",
            parameters={"db": schema, "tbl": table},
        ).result_rows
        columns = [
            ColumnInfo(name=str(row[0]), data_type=str(row[1]), nullable=True) for row in rows if row
        ]
        if len(columns) > CLICKHOUSE_MAX_COLUMNS:
            return columns[:CLICKHOUSE_MAX_COLUMNS]
        return columns
