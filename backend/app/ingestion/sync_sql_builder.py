"""同步拉数 SQL 构建：按 query dialect 生成全量/增量 SELECT。"""

from __future__ import annotations

from app.ingestion.models import INGESTION_MAX_ROWS, SyncJob
from app.ingestion.sync_table_ref import resolve_sync_schema_and_table
from app.query.dialects import get_sql_dialect
from app.query.dialects.base import SqlDialect
from app.query.rls.guard import validate_identifier


def qualify_sync_table(dialect: SqlDialect, job: SyncJob) -> str:
    schema, table = resolve_sync_schema_and_table(job)
    dt = dialect.connector_type
    if dt == "sqlite":
        return dialect.quote_identifier(table)
    if dt == "trino":
        catalog, table = resolve_sync_schema_and_table(job)
        trino_schema = (job.source_schema or "default").strip()
        validate_identifier(catalog)
        validate_identifier(trino_schema)
        return (
            f"{dialect.quote_identifier(catalog)}."
            f"{dialect.quote_identifier(trino_schema)}."
            f"{dialect.quote_identifier(table)}"
        )
    return dialect.qualify_table(schema, table)


def build_sync_select(job: SyncJob, dialect_type: str) -> tuple[str, tuple[object, ...]]:
    dialect = get_sql_dialect(dialect_type)
    ref = qualify_sync_table(dialect, job)
    limit = INGESTION_MAX_ROWS
    if job.sync_mode == "incremental" and job.incremental_column:
        inc = dialect.quote_identifier(job.incremental_column)
        if job.last_watermark:
            sql = f"SELECT * FROM {ref} WHERE {inc} > %s ORDER BY {inc} LIMIT %s"
            return sql, (job.last_watermark, limit)
        sql = f"SELECT * FROM {ref} WHERE {inc} IS NOT NULL ORDER BY {inc} LIMIT %s"
        return sql, (limit,)
    sql = f"SELECT * FROM {ref} LIMIT %s"
    return sql, (limit,)
