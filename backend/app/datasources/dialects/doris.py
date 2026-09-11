from __future__ import annotations

from typing import Any

from app.datasources.dialects.base import ColumnInfo, SchemaInfo, TableInfo, TestConnectionResult
from app.datasources.dialects.errors import (
    DORIS_AUTH_FAILED,
    DORIS_CONN_REFUSED,
    DORIS_TIMEOUT,
    DORIS_UNKNOWN,
    DORIS_UNKNOWN_DATABASE,
)
from app.datasources.dialects.mysql import MysqlConnector


DORIS_MAX_COLUMNS = 500
_DORIS_SYSTEM_DATABASES = frozenset({"information_schema", "mysql", "performance_schema", "sys"})


class DorisConnector:
    type = "doris"
    category = "olap"
    capabilities = ("connectivity_test", "schema_browser")
    display_name = "Apache Doris"

    def __init__(self) -> None:
        self._inner = MysqlConnector()

    def test_connection(self, **kwargs) -> TestConnectionResult:
        result = self._inner.test_connection(**kwargs)
        if result.ok or not result.code:
            return result
        mapping = {
            "MYSQL_TIMEOUT": DORIS_TIMEOUT,
            "MYSQL_CONN_REFUSED": DORIS_CONN_REFUSED,
            "MYSQL_AUTH_FAILED": DORIS_AUTH_FAILED,
            "MYSQL_UNKNOWN_DATABASE": DORIS_UNKNOWN_DATABASE,
        }
        code = mapping.get(result.code, DORIS_UNKNOWN)
        return TestConnectionResult(
            ok=result.ok,
            message=result.message.replace(result.code, code) if result.code in result.message else result.message,
            latency_ms=result.latency_ms,
            code=code,
        )

    def open_connection(self, **kwargs) -> Any:
        return self._inner.open_connection(**kwargs)

    def list_schemas(self, connection: Any) -> list[SchemaInfo]:
        schemas = self._inner.list_schemas(connection)
        return [s for s in schemas if s.name not in _DORIS_SYSTEM_DATABASES]

    def list_tables(self, connection: Any, schema: str) -> list[TableInfo]:
        if not schema.strip():
            return []
        return self._inner.list_tables(connection, schema)

    def list_columns(self, connection: Any, schema: str, table: str) -> list[ColumnInfo]:
        columns = self._inner.list_columns(connection, schema, table)
        if len(columns) > DORIS_MAX_COLUMNS:
            return columns[:DORIS_MAX_COLUMNS]
        return columns
