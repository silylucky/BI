from __future__ import annotations

import time
from typing import Any

from app.datasources.dialects.base import ColumnInfo, SchemaInfo, TableInfo, TestConnectionResult
from app.datasources.dialects.errors import map_impala_error
from app.query.rls.guard import validate_identifier

IMPALA_MAX_COLUMNS = 500


def _quote_ident(name: str) -> str:
    validate_identifier(name)
    return f"`{name}`"


class ImpalaConnector:
    type = "impala"
    category = "lake"
    capabilities = ("connectivity_test", "schema_browser")
    display_name = "Apache Impala"

    def _connect(self, **kwargs: Any) -> Any:
        import pyhive.hive

        return pyhive.hive.connect(
            host=kwargs["host"],
            port=int(kwargs.get("port", 21050)),
            username=kwargs.get("username") or "impala",
            password=kwargs.get("password") or "",
            database=kwargs.get("database") or "default",
            auth="NOSASL",
        )

    def open_connection(self, **kwargs: Any) -> Any:
        return self._connect(**kwargs)

    def test_connection(self, **kwargs: Any) -> TestConnectionResult:
        started = time.perf_counter()
        try:
            conn = self.open_connection(**kwargs)
            try:
                cur = conn.cursor()
                cur.execute("SELECT 1")
            finally:
                conn.close()
        except Exception as exc:
            code, detail = map_impala_error(exc)
            if "does not exist" in detail.lower():
                code = "IMPALA_UNKNOWN_DATABASE"
            return TestConnectionResult(
                ok=False,
                message=f"[{code}] {detail}",
                latency_ms=int((time.perf_counter() - started) * 1000),
                code=code,
            )
        return TestConnectionResult(
            ok=True,
            message="Connection successful",
            latency_ms=int((time.perf_counter() - started) * 1000),
            code=None,
        )

    def probe_readonly_sql(self, connection: Any) -> bool:
        cur = connection.cursor()
        cur.execute("SELECT 1")
        return True

    def list_schemas(self, connection: Any) -> list[SchemaInfo]:
        cur = connection.cursor()
        cur.execute("SHOW DATABASES")
        return [SchemaInfo(name=row[0]) for row in cur.fetchall() if row]

    def list_tables(self, connection: Any, schema: str) -> list[TableInfo]:
        if not schema.strip():
            return []
        cur = connection.cursor()
        cur.execute(f"SHOW TABLES IN {_quote_ident(schema)}")
        return [TableInfo(name=row[0], type="TABLE") for row in cur.fetchall() if row]

    def list_columns(self, connection: Any, schema: str, table: str) -> list[ColumnInfo]:
        if not schema.strip() or not table.strip():
            return []
        cur = connection.cursor()
        cur.execute(f"DESCRIBE {_quote_ident(schema)}.{_quote_ident(table)}")
        cols = []
        for row in cur.fetchall():
            if row and row[0] and not str(row[0]).startswith("#"):
                cols.append(ColumnInfo(name=str(row[0]), data_type=str(row[1]), nullable=True))
        return cols[:IMPALA_MAX_COLUMNS]
