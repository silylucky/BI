"""同步拉数时的 schema / 表名解析（PostgreSQL 库名 ≠ schema）。"""

from __future__ import annotations

from app.ingestion.models import SyncJob
from app.query.capabilities import resolve_sql_dialect_type

_PG_SCHEMA_DEFAULT = "public"
_PG_SOURCE_TYPES = frozenset({"postgresql", "timescaledb", "kingbase", "gaussdb", "redshift"})


def _split_qualified_table(raw: str) -> tuple[str, str] | None:
    trimmed = raw.strip()
    if "." not in trimmed:
        return None
    schema, table = trimmed.split(".", 1)
    schema = schema.strip()
    table = table.strip()
    if not schema or not table:
        return None
    return schema, table


def uses_postgres_schema_semantics(source_type: str) -> bool:
    return resolve_sql_dialect_type(source_type) == "postgresql"


def resolve_sync_schema_and_table(job: SyncJob) -> tuple[str, str]:
    """返回 SQL 命名空间与裸表名（用于 qualify_table / list_columns）。"""
    raw_table = (job.source_table or "").strip()
    if not raw_table:
        raise ValueError("须指定 source_table")

    qualified = _split_qualified_table(raw_table)
    if qualified is not None:
        return qualified

    dialect_type = resolve_sql_dialect_type(job.source_type)
    if dialect_type == "postgresql" or job.source_type in _PG_SOURCE_TYPES:
        schema = (job.source_schema or "").strip() or _PG_SCHEMA_DEFAULT
        return schema, raw_table
    if dialect_type == "oracle":
        schema = (job.source_database or job.source_username or "").strip()
        return schema, raw_table
    if dialect_type == "sqlserver":
        schema = (job.source_database or "dbo").strip()
        return schema, raw_table
    if dialect_type == "trino":
        catalog = (job.source_database or "default").strip()
        return catalog, raw_table

    namespace = (job.source_database or "default").strip()
    return namespace, raw_table
