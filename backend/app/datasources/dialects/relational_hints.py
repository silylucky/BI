from __future__ import annotations

from app.datasources.type_normalize import normalize_column_type

__all__ = ["quote_identifier", "build_limit_clause", "normalize_column_type"]


def quote_identifier(dialect: str, name: str) -> str:
    if dialect == "oracle":
        return f'"{name.upper()}"'
    if dialect == "sqlserver":
        return f"[{name}]"
    raise ValueError(f"unsupported dialect for quote_identifier: {dialect}")


def build_limit_clause(dialect: str, limit: int, offset: int) -> str:
    if dialect not in {"oracle", "sqlserver"}:
        raise ValueError(f"unsupported dialect for build_limit_clause: {dialect}")
    return f"OFFSET {offset} ROWS FETCH NEXT {limit} ROWS ONLY"


