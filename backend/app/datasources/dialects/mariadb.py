from __future__ import annotations

from typing import Any

from app.datasources.dialects.base import ColumnInfo, SchemaInfo, TableInfo, TestConnectionResult
from app.datasources.dialects.mysql import MysqlConnector


class MariadbConnector:
    type = "mariadb"
    category = "relational"
    capabilities = ("connectivity_test", "schema_browser")
    display_name = "MariaDB"

    def __init__(self) -> None:
        self._inner = MysqlConnector()

    def test_connection(self, **kwargs) -> TestConnectionResult:
        return self._inner.test_connection(**kwargs)

    def open_connection(self, **kwargs) -> Any:
        return self._inner.open_connection(**kwargs)

    def list_schemas(self, connection: Any) -> list[SchemaInfo]:
        return self._inner.list_schemas(connection)

    def list_tables(self, connection: Any, schema: str) -> list[TableInfo]:
        return self._inner.list_tables(connection, schema)

    def list_columns(self, connection: Any, schema: str, table: str) -> list[ColumnInfo]:
        return self._inner.list_columns(connection, schema, table)
