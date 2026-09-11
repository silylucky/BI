from __future__ import annotations

import re

from app.query.table_ref import qualify_table_reference
from app.query.rls.guard import validate_identifier


class OracleDialect:
    connector_type = "oracle"

    def quote_identifier(self, name: str) -> str:
        validate_identifier(name)
        return f'"{name}"'

    def qualify_table(self, schema: str, table: str) -> str:
        return qualify_table_reference(
            quote_identifier=self.quote_identifier,
            schema=schema,
            table=table,
        )

    def _paginate(self, sql: str, *, limit: int, offset: int) -> str:
        return (
            f"{sql} ORDER BY 1 "
            f"OFFSET {int(offset)} ROWS FETCH NEXT {int(limit)} ROWS ONLY"
        )

    def wrap_limit(self, sql: str, *, limit: int, offset: int = 0) -> str:
        normalized = sql.strip().rstrip(";")
        if re.search(r"\border\s+by\b", normalized, re.IGNORECASE):
            return (
                f"{normalized} OFFSET {int(offset)} ROWS "
                f"FETCH NEXT {int(limit)} ROWS ONLY"
            )
        inner = f"SELECT * FROM ({normalized}) _vs"
        return self._paginate(inner, limit=limit, offset=offset)

    def build_table_select(
        self, schema: str, table: str, *, limit: int, offset: int = 0,
    ) -> str:
        qualified = self.qualify_table(schema, table)
        return self._paginate(f"SELECT * FROM {qualified}", limit=limit, offset=offset)
