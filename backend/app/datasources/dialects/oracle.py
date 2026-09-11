from __future__ import annotations

import time
from typing import Any

from app.datasources.dialects.base import ColumnInfo, SchemaInfo, TableInfo, TestConnectionResult
from app.datasources.dialects.errors import _SYSTEM_OWNERS, map_oracle_error
from app.datasources.dialects.relational_hints import normalize_column_type

ORACLE_MAX_COLUMNS = 500


class OracleConnector:
    type = "oracle"
    category = "relational"
    capabilities = ("connectivity_test", "schema_browser")
    display_name = "Oracle"

    def _connect(self, **kwargs: Any) -> Any:
        import oracledb

        dsn = oracledb.makedsn(kwargs["host"], kwargs.get("port", 1521), service_name=kwargs["database"])
        return oracledb.connect(user=kwargs["username"], password=kwargs["password"], dsn=dsn)

    def open_connection(self, **kwargs: Any) -> Any:
        return self._connect(**kwargs)

    def test_connection(self, **kwargs: Any) -> TestConnectionResult:
        started = time.perf_counter()
        try:
            connection = self._connect(**kwargs)
            try:
                cursor = connection.cursor()
                cursor.execute("SELECT 1 FROM DUAL")
            finally:
                connection.close()
        except Exception as exc:
            code, detail = map_oracle_error(exc)
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
        cursor.execute(
            """
            SELECT DISTINCT OWNER FROM ALL_TABLES
            WHERE OWNER NOT IN ('SYS','SYSTEM')
            ORDER BY 1
            """
        )
        return [
            SchemaInfo(name=row[0])
            for row in cursor.fetchall()
            if row and row[0] not in _SYSTEM_OWNERS
        ]

    def list_tables(self, connection: Any, schema: str) -> list[TableInfo]:
        if not schema.strip():
            return []
        cursor = connection.cursor()
        cursor.execute(
            "SELECT TABLE_NAME, 'TABLE' FROM ALL_TABLES WHERE OWNER = :owner ORDER BY 1",
            owner=schema.upper(),
        )
        return [TableInfo(name=row[0], type=row[1]) for row in cursor.fetchall() if row]

    def list_columns(self, connection: Any, schema: str, table: str) -> list[ColumnInfo]:
        if not schema.strip() or not table.strip():
            return []
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT COLUMN_NAME, DATA_TYPE, NULLABLE
            FROM ALL_TAB_COLUMNS
            WHERE OWNER = :owner AND TABLE_NAME = :table_name
            ORDER BY COLUMN_ID
            """,
            owner=schema.upper(),
            table_name=table.upper(),
        )
        columns = [
            ColumnInfo(
                name=row[0],
                data_type=normalize_column_type("oracle", str(row[1])),
                nullable=str(row[2]) == "Y",
            )
            for row in cursor.fetchall()
            if row
        ]
        if len(columns) > ORACLE_MAX_COLUMNS:
            return columns[:ORACLE_MAX_COLUMNS]
        return columns
