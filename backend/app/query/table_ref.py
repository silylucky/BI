"""表名限定：schema 为空时退化为裸表名（连接默认库 / search_path）。"""

from __future__ import annotations

from collections.abc import Callable


def qualify_table_reference(
    *,
    quote_identifier: Callable[[str], str],
    schema: str,
    table: str,
) -> str:
    schema_part = (schema or "").strip()
    if schema_part:
        return f"{quote_identifier(schema_part)}.{quote_identifier(table)}"
    return quote_identifier(table)
