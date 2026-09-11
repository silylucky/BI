from __future__ import annotations

import time
from typing import Any

from app.datasources.dialects.base import (
    ColumnInfo,
    SchemaInfo,
    TableInfo,
    TestConnectionResult,
)
from app.datasources.dialects.errors import map_redshift_error
from app.datasources.dialects.postgres import PostgresConnector

_REDSHIFT_SSL_MODES = frozenset({"disabled", "preferred", "required"})


class RedshiftConnector:
    type = "redshift"
    category = "olap"
    capabilities = ("connectivity_test", "schema_browser")
    display_name = "AWS Redshift"

    def __init__(self) -> None:
        self._delegate = PostgresConnector()

    def open_connection(
        self,
        *,
        host: str,
        port: int = 5439,
        database: str,
        username: str,
        password: str,
        connect_timeout_sec: float = 5.0,
        ssl_mode: str = "required",
        **_: Any,
    ) -> Any:
        return self._delegate.open_connection(
            host=host,
            port=port,
            database=database,
            username=username,
            password=password,
            connect_timeout_sec=connect_timeout_sec,
            ssl_mode=ssl_mode,
        )

    def test_connection(
        self,
        *,
        host: str,
        port: int = 5439,
        database: str,
        username: str,
        password: str,
        connect_timeout_sec: float = 5.0,
        ssl_mode: str = "required",
        **_: Any,
    ) -> TestConnectionResult:
        started = time.perf_counter()
        try:
            conn = self.open_connection(
                host=host,
                port=port,
                database=database,
                username=username,
                password=password,
                connect_timeout_sec=connect_timeout_sec,
                ssl_mode=ssl_mode,
            )
            try:
                conn.execute("SELECT 1")
            finally:
                conn.close()
        except Exception as exc:
            code, detail = map_redshift_error(exc)
            latency_ms = int((time.perf_counter() - started) * 1000)
            return TestConnectionResult(
                ok=False,
                message=f"[{code}] {detail}",
                latency_ms=latency_ms,
                code=code,
            )
        latency_ms = int((time.perf_counter() - started) * 1000)
        return TestConnectionResult(
            ok=True,
            message="Connection successful",
            latency_ms=latency_ms,
            code=None,
        )

    def probe_readonly_sql(self, connection: Any) -> bool:
        connection.execute("SELECT 1")
        return True

    def list_schemas(self, connection: Any) -> list[SchemaInfo]:
        return self._delegate.list_schemas(connection)

    def list_tables(self, connection: Any, schema: str) -> list[TableInfo]:
        return self._delegate.list_tables(connection, schema)

    def list_columns(self, connection: Any, schema: str, table: str) -> list[ColumnInfo]:
        return self._delegate.list_columns(connection, schema, table)
