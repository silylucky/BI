from __future__ import annotations

from app.query.table_ref import qualify_table_reference
from app.query.rls.guard import validate_identifier


class SqliteDialect:
    connector_type = "sqlite"

    def quote_identifier(self, name: str) -> str:
        validate_identifier(name)
        return f'"{name}"'

    def qualify_table(self, schema: str, table: str) -> str:
        return qualify_table_reference(
            quote_identifier=self.quote_identifier,
            schema=schema,
            table=table,
        )

    def wrap_limit(self, sql: str, *, limit: int, offset: int = 0) -> str:
        normalized = sql.strip().rstrip(";")
        return f"{normalized} LIMIT {int(limit)} OFFSET {int(offset)}"

    def build_table_select(
        self, schema: str, table: str, *, limit: int, offset: int = 0,
    ) -> str:
        qualified = self.qualify_table(schema, table)
        return (
            f"SELECT * FROM {qualified} "
            f"LIMIT {int(limit)} OFFSET {int(offset)}"
        )
