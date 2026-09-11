from __future__ import annotations

from typing import Any

from app.datasources.dialects.base import ColumnInfo, SchemaInfo, TableInfo, TestConnectionResult
from app.datasources.dialects.errors import (
    STARROCKS_AUTH_FAILED,
    STARROCKS_CONN_REFUSED,
    STARROCKS_TIMEOUT,
    STARROCKS_UNKNOWN,
    STARROCKS_UNKNOWN_DATABASE,
)
from app.datasources.dialects.mysql import MysqlConnector

STARROCKS_MAX_COLUMNS = 500


class StarrocksConnector:
    type = "starrocks"
    category = "olap"
    capabilities = ("connectivity_test", "schema_browser")
    display_name = "StarRocks"

    def __init__(self) -> None:
        self._inner = MysqlConnector()

    def test_connection(self, **kwargs) -> TestConnectionResult:
        result = self._inner.test_connection(**kwargs)
        if result.ok or not result.code:
            return result
        mapping = {
            "MYSQL_TIMEOUT": STARROCKS_TIMEOUT,
            "MYSQL_CONN_REFUSED": STARROCKS_CONN_REFUSED,
            "MYSQL_AUTH_FAILED": STARROCKS_AUTH_FAILED,
            "MYSQL_UNKNOWN_DATABASE": STARROCKS_UNKNOWN_DATABASE,
        }
        code = mapping.get(result.code, STARROCKS_UNKNOWN)
        return TestConnectionResult(
            ok=result.ok,
            message=result.message.replace(result.code, code) if result.code in result.message else result.message,
            latency_ms=result.latency_ms,
            code=code,
        )

    def open_connection(self, **kwargs) -> Any:
        return self._inner.open_connection(**kwargs)

    def list_schemas(self, connection: Any) -> list[SchemaInfo]:
        return self._inner.list_schemas(connection)

    def list_tables(self, connection: Any, schema: str) -> list[TableInfo]:
        if not schema.strip():
            return []
        return self._inner.list_tables(connection, schema)

    def list_columns(self, connection: Any, schema: str, table: str) -> list[ColumnInfo]:
        columns = self._inner.list_columns(connection, schema, table)
        if len(columns) > STARROCKS_MAX_COLUMNS:
            return columns[:STARROCKS_MAX_COLUMNS]
        return columns
