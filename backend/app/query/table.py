from __future__ import annotations

from app.query.dialects import get_sql_dialect


def build_table_sql(
    connector_type: str, schema: str, table: str, *, limit: int, offset: int = 0,
) -> str:
    dialect = get_sql_dialect(connector_type)
    return dialect.build_table_select(schema, table, limit=limit, offset=offset)
