from __future__ import annotations

from typing import Any

from app.datasources.dialects.base import ColumnInfo, SchemaInfo, TableInfo, TestConnectionResult
from app.datasources.dialects.kingbase.params import KingbaseParamsError, validate_kingbase_connection_params
from app.datasources.dialects.postgres import PostgresConnector

KINGBASE_MAX_COLUMNS = 500
KINGBASE_DEFAULT_PORT = 54321


class KingbaseConnector:
    type = "kingbase"
    category = "relational"
    capabilities = ("connectivity_test", "schema_browser")
    display_name = "人大金仓 KingbaseES"

    def __init__(self) -> None:
        self._inner = PostgresConnector()

    def test_connection(self, **kwargs) -> TestConnectionResult:
        try:
            validate_kingbase_connection_params(
                host=kwargs.get("host"),
                port=kwargs.get("port", KINGBASE_DEFAULT_PORT),
                database=kwargs.get("database"),
                username=kwargs.get("username"),
            )
        except KingbaseParamsError as exc:
            return TestConnectionResult(ok=False, message=exc.message, latency_ms=0, code=exc.code)
        port = kwargs.get("port", KINGBASE_DEFAULT_PORT)
        return self._inner.test_connection(**{**kwargs, "port": port})

    def open_connection(self, **kwargs) -> Any:
        port = kwargs.get("port", KINGBASE_DEFAULT_PORT)
        return self._inner.open_connection(**{**kwargs, "port": port})

    def list_schemas(self, connection: Any) -> list[SchemaInfo]:
        return self._inner.list_schemas(connection)

    def list_tables(self, connection: Any, schema: str) -> list[TableInfo]:
        return self._inner.list_tables(connection, schema)

    def list_columns(self, connection: Any, schema: str, table: str) -> list[ColumnInfo]:
        cols = self._inner.list_columns(connection, schema, table)
        return cols[:KINGBASE_MAX_COLUMNS]

    def probe_readonly_sql(self, connection: Any) -> bool:
        """Execute minimal read-only probe; return True on success."""
        connection.execute("SELECT 1")
        return True
