from __future__ import annotations

import time
from typing import Any

from app.datasources.dialects.base import ColumnInfo, SchemaInfo, TableInfo, TestConnectionResult
from app.datasources.dialects.errors import map_hive_error

HIVE_MAX_COLUMNS = 500

_SYSTEM_SCHEMAS = frozenset({"information_schema"})


class HiveConnector:
    type = "hive"
    category = "lake"
    capabilities = ("connectivity_test", "schema_browser")
    display_name = "Apache Hive"

    def _connect(self, **kwargs: Any) -> Any:
        import pyhive.hive

        host = kwargs["host"]
        port = kwargs.get("port", 10000)
        username = kwargs["username"]
        password = kwargs["password"]
        database = kwargs.get("database") or "default"
        return pyhive.hive.connect(
            host=host,
            port=port,
            username=username,
            password=password,
            database=database,
        )

    def open_connection(self, **kwargs: Any) -> Any:
        return self._connect(**kwargs)

    def test_connection(self, **kwargs: Any) -> TestConnectionResult:
        started = time.perf_counter()
        try:
            connection = self._connect(**kwargs)
            try:
                cursor = connection.cursor()
                cursor.execute("SELECT 1")
            finally:
                connection.close()
        except Exception as exc:
            code, detail = map_hive_error(exc)
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
        cursor = connection.cursor()
        cursor.execute("SHOW DATABASES")
        rows = cursor.fetchall()
        return [
            SchemaInfo(name=row[0])
            for row in rows
            if row and row[0] not in _SYSTEM_SCHEMAS
        ]

    def list_tables(self, connection: Any, schema: str) -> list[TableInfo]:
        if not schema.strip():
            return []
        cursor = connection.cursor()
        cursor.execute(f"SHOW TABLES IN {schema}")
        rows = cursor.fetchall()
        return [TableInfo(name=row[0], type="TABLE") for row in rows if row]

    def list_columns(self, connection: Any, schema: str, table: str) -> list[ColumnInfo]:
        if not schema.strip() or not table.strip():
            return []
        cursor = connection.cursor()
        cursor.execute(f"DESCRIBE {schema}.{table}")
        rows = cursor.fetchall()
        columns: list[ColumnInfo] = []
        for row in rows:
            if not row or not row[0] or str(row[0]).startswith("#"):
                continue
            columns.append(ColumnInfo(name=str(row[0]), data_type=str(row[1]), nullable=True))
        if len(columns) > HIVE_MAX_COLUMNS:
            return columns[:HIVE_MAX_COLUMNS]
        return columns
