from __future__ import annotations

import time
from typing import Any

from app.datasources.dialects.base import ColumnInfo, SchemaInfo, TableInfo, TestConnectionResult
from app.datasources.dialects.errors import TIMESCALE_EXTENSION_MISSING, map_timescale_error
from app.datasources.dialects.postgres import PostgresConnector

TIMESCALE_MAX_COLUMNS = 500


class TimescaledbConnector:
    type = "timescaledb"
    category = "timeseries"
    capabilities = ("connectivity_test", "schema_browser")
    display_name = "TimescaleDB"

    def __init__(self) -> None:
        self._delegate = PostgresConnector()

    def _hypertable_names(self, connection: Any, schema: str) -> set[str]:
        try:
            cur = connection.execute(
                "SELECT hypertable_name FROM timescaledb_information.hypertables WHERE hypertable_schema = %s",
                (schema,),
            )
            return {row[0] for row in cur.fetchall()}
        except Exception:
            return set()

    def test_connection(self, *, host: str, port: int, database: str, username: str, password: str, timeout_sec: float = 5.0, **kwargs: object) -> TestConnectionResult:
        started = time.perf_counter()
        try:
            conn = self._delegate.open_connection(
                host=host, port=port, database=database, username=username, password=password,
                connect_timeout_sec=timeout_sec, ssl_mode=kwargs.get("ssl_mode", "preferred"),
            )
            try:
                conn.execute("SELECT 1")
                ext = conn.execute("SELECT 1 FROM pg_extension WHERE extname = 'timescaledb'")
                if ext.fetchone() is None:
                    latency_ms = int((time.perf_counter() - started) * 1000)
                    return TestConnectionResult(
                        ok=False,
                        message=f"[{TIMESCALE_EXTENSION_MISSING}] timescaledb extension not installed",
                        latency_ms=latency_ms,
                        code=TIMESCALE_EXTENSION_MISSING,
                    )
            finally:
                conn.close()
        except Exception as exc:
            code, detail = map_timescale_error(exc)
            latency_ms = int((time.perf_counter() - started) * 1000)
            return TestConnectionResult(ok=False, message=f"[{code}] {detail}", latency_ms=latency_ms, code=code)
        latency_ms = int((time.perf_counter() - started) * 1000)
        return TestConnectionResult(ok=True, message="Connection successful", latency_ms=latency_ms, code=None)

    def open_connection(self, **kwargs: Any) -> Any:
        return self._delegate.open_connection(**kwargs)

    def list_schemas(self, connection: Any) -> list[SchemaInfo]:
        return self._delegate.list_schemas(connection) or []

    def list_tables(self, connection: Any, schema: str) -> list[TableInfo]:
        if not schema.strip():
            return []
        tables = self._delegate.list_tables(connection, schema) or []
        hypertables = self._hypertable_names(connection, schema)
        return [
            TableInfo(name=t.name, type="hypertable" if t.name in hypertables else t.type)
            for t in tables
        ]

    def probe_readonly_sql(self, connection: Any) -> bool:
        connection.execute("SELECT 1")
        return True

    def list_columns(self, connection: Any, schema: str, table: str) -> list[ColumnInfo]:
        columns = self._delegate.list_columns(connection, schema, table)
        # r41: 委托 PG list_columns 后按 TIMESCALE_MAX_COLUMNS 切片
        return columns[:TIMESCALE_MAX_COLUMNS] if len(columns) > TIMESCALE_MAX_COLUMNS else columns
