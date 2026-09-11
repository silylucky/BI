from __future__ import annotations

from typing import Any

from app.datasources.dialects.base import ColumnInfo, SchemaInfo, TableInfo, TestConnectionResult
from app.datasources.dialects.mysql import MysqlConnector

OCEANBASE_MAX_COLUMNS = 500
OCEANBASE_DEFAULT_PORT = 2881
probe_test_connection_budget_ms: int = 100


class OceanbaseConnector:
    type = "oceanbase"
    category = "relational"
    capabilities = ("connectivity_test", "schema_browser")
    display_name = "OceanBase"

    def __init__(self) -> None:
        self._inner = MysqlConnector()

    def test_connection(self, **kwargs) -> TestConnectionResult:
        port = kwargs.get("port", OCEANBASE_DEFAULT_PORT)
        result = self._inner.test_connection(**{**kwargs, "port": port})
        if result.ok or not result.code:
            return result
        mapping = {
            "MYSQL_TIMEOUT": "OCEANBASE_TIMEOUT",
            "MYSQL_CONN_REFUSED": "OCEANBASE_CONN_REFUSED",
            "MYSQL_AUTH_FAILED": "OCEANBASE_AUTH_FAILED",
            "MYSQL_UNKNOWN_DATABASE": "OCEANBASE_UNKNOWN_DATABASE",
        }
        code = mapping.get(result.code, "OCEANBASE_UNKNOWN")
        return TestConnectionResult(
            ok=result.ok,
            message=result.message.replace(result.code, code) if result.code in result.message else result.message,
            latency_ms=result.latency_ms,
            code=code,
        )

    def open_connection(self, **kwargs) -> Any:
        port = kwargs.get("port", OCEANBASE_DEFAULT_PORT)
        return self._inner.open_connection(**{**kwargs, "port": port})

    def list_schemas(self, connection: Any) -> list[SchemaInfo]:
        # Empty tenant/database returns [] — symmetric with GBase companion pattern.
        return self._inner.list_schemas(connection)

    def list_tables(self, connection: Any, schema: str) -> list[TableInfo]:
        return self._inner.list_tables(connection, schema)

    def list_columns(self, connection: Any, schema: str, table: str) -> list[ColumnInfo]:
        cols = self._inner.list_columns(connection, schema, table)
        return cols[:OCEANBASE_MAX_COLUMNS]

    def probe_readonly_sql(self, connection: Any) -> bool:
        """Execute minimal read-only probe; return True on success."""
        cursor = connection.cursor()
        cursor.execute("SELECT 1")
        return True
