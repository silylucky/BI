from __future__ import annotations

from sqlalchemy import ColumnElement, func
from sqlalchemy.orm import InstrumentedAttribute

from app.core.db.meta import get_meta_engine


def ilike(
    column: ColumnElement | InstrumentedAttribute,
    pattern: str,
) -> ColumnElement:
    """Case-insensitive LIKE portable across PostgreSQL, SQLite, and MySQL."""
    dialect_name = get_meta_engine().dialect.name
    if dialect_name == "mysql":
        return func.lower(column).like(pattern.lower())
    return column.ilike(pattern)
