from __future__ import annotations

from app.query.rls.guard import validate_identifier

# RoAPI list_schemas 返回虚拟 schema「roapi」；SQL 侧表名为顶层注册名（如 demo_orders）。
_ROAPI_VIRTUAL_SCHEMA = "roapi"


class RoapiDialect:
    connector_type = "roapi"

    def quote_identifier(self, name: str) -> str:
        validate_identifier(name)
        return f'"{name}"'

    def qualify_table(self, schema: str, table: str) -> str:
        validate_identifier(table)
        schema_part = (schema or "").strip()
        if schema_part and schema_part != _ROAPI_VIRTUAL_SCHEMA:
            return f'{self.quote_identifier(schema_part)}.{self.quote_identifier(table)}'
        return self.quote_identifier(table)

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
