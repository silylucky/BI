from __future__ import annotations

from typing import Any

from app.datasources.dialects.base import ColumnInfo, SchemaInfo, TableInfo, TestConnectionResult
from app.datasources.dialects.postgres import PostgresConnector

GAUSSDB_MAX_COLUMNS = 500


class GaussdbConnector:
    type = "gaussdb"
    category = "relational"
    capabilities = ("connectivity_test", "schema_browser")
    display_name = "GaussDB"

    def __init__(self) -> None:
        self._delegate = PostgresConnector()

    def open_connection(self, **kwargs: Any) -> Any:
        return self._delegate.open_connection(**kwargs)

    def test_connection(self, **kwargs: Any) -> TestConnectionResult:
        return self._delegate.test_connection(**kwargs)

    def list_schemas(self, connection: Any) -> list[SchemaInfo]:
        schemas = self._delegate.list_schemas(connection)
        return schemas or []

    def list_tables(self, connection: Any, schema: str) -> list[TableInfo]:
        if not schema.strip():
            return []
        return self._delegate.list_tables(connection, schema) or []

    def list_columns(self, connection: Any, schema: str, table: str) -> list[ColumnInfo]:
        columns = self._delegate.list_columns(connection, schema, table)
        return columns[:GAUSSDB_MAX_COLUMNS] if len(columns) > GAUSSDB_MAX_COLUMNS else columns

    def probe_readonly_sql(self, connection: Any) -> bool:
        """Execute minimal read-only probe; return True on success."""
        connection.execute("SELECT 1")
        return True
