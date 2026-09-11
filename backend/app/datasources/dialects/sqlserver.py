from __future__ import annotations

import time
from typing import Any

import pymssql

from app.datasources.dialects.base import ColumnInfo, SchemaInfo, TableInfo, TestConnectionResult
from app.datasources.dialects.errors import map_sqlserver_operational_error
from app.datasources.dialects.relational_hints import normalize_column_type

SQLSERVER_MAX_COLUMNS = 500

_SSL_MODES = frozenset({"disabled", "preferred", "required"})


class SqlserverConnector:
    type = "sqlserver"
    category = "relational"
    capabilities = ("connectivity_test", "schema_browser")
    display_name = "SQL Server"

    def _build_connect_kwargs(self, **kwargs: Any) -> dict:
        ssl_mode = kwargs.get("ssl_mode", "preferred")
        if ssl_mode not in _SSL_MODES:
            raise ValueError(f"invalid ssl_mode: {ssl_mode}")
        connect_kwargs: dict = {
            "server": kwargs["host"],
            "port": kwargs.get("port", 1433),
            "user": kwargs["username"],
            "password": kwargs["password"],
            "database": kwargs.get("database") or "master",
            "login_timeout": int(kwargs.get("connect_timeout_sec", 5)),
        }
        if ssl_mode == "required":
            connect_kwargs["encrypt"] = True
        elif ssl_mode == "disabled":
            connect_kwargs["encrypt"] = False
        return connect_kwargs

    def open_connection(self, **kwargs: Any) -> Any:
        return pymssql.connect(**self._build_connect_kwargs(**kwargs))

    def test_connection(self, **kwargs: Any) -> TestConnectionResult:
        started = time.perf_counter()
        try:
            connection = self.open_connection(**kwargs)
            try:
                cursor = connection.cursor()
                cursor.execute("SELECT 1")
            finally:
                connection.close()
        except pymssql.Error as exc:
            code, detail = map_sqlserver_operational_error(exc)
            latency_ms = int((time.perf_counter() - started) * 1000)
            return TestConnectionResult(
                ok=False,
                message=f"[{code}] {detail}",
                latency_ms=latency_ms,
                code=code,
            )
        except Exception as exc:
            latency_ms = int((time.perf_counter() - started) * 1000)
            return TestConnectionResult(ok=False, message=str(exc), latency_ms=latency_ms, code=None)
        latency_ms = int((time.perf_counter() - started) * 1000)
        return TestConnectionResult(ok=True, message="Connection successful", latency_ms=latency_ms, code=None)

    def list_schemas(self, connection: Any) -> list[SchemaInfo]:
        cursor = connection.cursor()
        cursor.execute("SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA ORDER BY 1")
        return [SchemaInfo(name=row[0]) for row in cursor.fetchall() if row]

    def list_tables(self, connection: Any, schema: str) -> list[TableInfo]:
        if not schema.strip():
            return []
        cursor = connection.cursor()
        cursor.execute(
            "SELECT TABLE_NAME, TABLE_TYPE FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = %s",
            (schema,),
        )
        return [
            TableInfo(name=row[0], type=row[1] or "TABLE")
            for row in cursor.fetchall()
            if row
        ]

    def list_columns(self, connection: Any, schema: str, table: str) -> list[ColumnInfo]:
        if not schema.strip() or not table.strip():
            return []
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s
            ORDER BY ORDINAL_POSITION
            """,
            (schema, table),
        )
        columns = [
            ColumnInfo(
                name=row[0],
                data_type=normalize_column_type("sqlserver", str(row[1])),
                nullable=str(row[2]).upper() == "YES",
            )
            for row in cursor.fetchall()
            if row
        ]
        if len(columns) > SQLSERVER_MAX_COLUMNS:
            return columns[:SQLSERVER_MAX_COLUMNS]
        return columns
