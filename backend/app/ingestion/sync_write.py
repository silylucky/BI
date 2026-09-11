from __future__ import annotations

import logging

from functools import lru_cache
from typing import Any

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from app.core.config import get_settings
from app.ingestion.models import SyncJob

_ANALYTICS_STATEMENT_TIMEOUT_MS = 60_000
_ANALYTICS_LOCK_TIMEOUT_MS = 30_000
_WRITE_CHUNK_SIZE = 5_000
logger = logging.getLogger(__name__)


def _executemany_chunked(conn, sql, rows: list[dict[str, Any]], *, chunk_size: int = _WRITE_CHUNK_SIZE) -> None:
    for offset in range(0, len(rows), chunk_size):
        conn.execute(sql, rows[offset : offset + chunk_size])


@lru_cache
def get_analytics_engine() -> Engine:
    settings = get_settings()
    url = settings.analytics_database_url
    if not url:
        raise RuntimeError("ANALYTICS_DB_NOT_CONFIGURED")
    return create_engine(
        url,
        pool_pre_ping=True,
        connect_args={"connect_timeout": 5},
        pool_timeout=10,
    )


def _begin_analytics_write():
    engine = get_analytics_engine()
    conn = engine.connect()
    tx = conn.begin()
    conn.execute(text(f"SET LOCAL lock_timeout = '{_ANALYTICS_LOCK_TIMEOUT_MS}'"))
    conn.execute(text(f"SET LOCAL statement_timeout = '{_ANALYTICS_STATEMENT_TIMEOUT_MS}'"))
    return conn, tx


def write_analytics_full(job: SyncJob, rows: list[dict[str, Any]]) -> int:
    if not get_settings().analytics_database_url:
        raise RuntimeError("ANALYTICS_DB_NOT_CONFIGURED")
    if not rows:
        return 0
    columns = list(rows[0].keys())
    col_defs = ", ".join(f'"{c}" TEXT' for c in columns)
    placeholders = ", ".join(f":{c}" for c in columns)
    quoted_cols = ", ".join(f'"{c}"' for c in columns)
    insert_sql = text(
        f'INSERT INTO "{job.target_table}" ({quoted_cols}) VALUES ({placeholders})',
    )
    conn, tx = _begin_analytics_write()
    try:
        conn.execute(text(f'DROP TABLE IF EXISTS "{job.target_table}"'))
        conn.execute(text(f'CREATE TABLE "{job.target_table}" ({col_defs})'))
        _executemany_chunked(conn, insert_sql, rows)
        tx.commit()
    except Exception:
        tx.rollback()
        raise
    finally:
        conn.close()
    return len(rows)


def _existing_columns(conn, table: str) -> set[str]:
    result = conn.execute(
        text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = :table",
        ),
        {"table": table},
    )
    return {str(row[0]) for row in result}


def _ensure_incremental_columns(conn, table: str, columns: list[str]) -> None:
    existing = _existing_columns(conn, table)
    for col in columns:
        if col in existing:
            continue
        conn.execute(text(f'ALTER TABLE "{table}" ADD COLUMN IF NOT EXISTS "{col}" TEXT'))


def write_analytics_incremental(job: SyncJob, rows: list[dict[str, Any]]) -> int:
    if not get_settings().analytics_database_url:
        raise RuntimeError("ANALYTICS_DB_NOT_CONFIGURED")
    if not rows:
        return 0
    if not job.primary_key:
        raise RuntimeError("增量同步须配置 primary_key")
    pk = job.primary_key
    columns = list(rows[0].keys())
    if pk not in columns:
        raise RuntimeError(f"主键列 {pk} 不在源数据中")
    col_defs = ", ".join(f'"{c}" TEXT' for c in columns)
    quoted_cols = ", ".join(f'"{c}"' for c in columns)
    placeholders = ", ".join(f":{c}" for c in columns)
    update_set = ", ".join(f'"{c}"=EXCLUDED."{c}"' for c in columns if c != pk)
    insert_sql = text(
        f'INSERT INTO "{job.target_table}" ({quoted_cols}) VALUES ({placeholders}) '
        f'ON CONFLICT ("{pk}") DO UPDATE SET {update_set}',
    )
    conn, tx = _begin_analytics_write()
    try:
        conn.execute(
            text(
                f'CREATE TABLE IF NOT EXISTS "{job.target_table}" ({col_defs}, '
                f'UNIQUE ("{pk}"))',
            ),
        )
        _ensure_incremental_columns(conn, job.target_table, columns)
        _executemany_chunked(conn, insert_sql, rows)
        tx.commit()
    except Exception:
        tx.rollback()
        raise
    finally:
        conn.close()
    return len(rows)


def write_analytics(job: SyncJob, rows: list[dict[str, Any]]) -> int:
    if job.sync_mode == "incremental":
        return write_analytics_incremental(job, rows)
    return write_analytics_full(job, rows)


def drop_analytics_table(target_table: str) -> bool:
    """删除分析库中的同步产出物理表（元数据清理时调用）。成功返回 True。"""
    if not get_settings().analytics_database_url:
        return True
    table = target_table.strip()
    if not table:
        return True
    try:
        conn, tx = _begin_analytics_write()
    except Exception as exc:
        logger.warning("drop_analytics_table_connect_failed table=%s err=%s", table, exc)
        return False
    try:
        conn.execute(text(f'DROP TABLE IF EXISTS "{table}"'))
        tx.commit()
        return True
    except Exception as exc:
        tx.rollback()
        logger.warning("drop_analytics_table_failed table=%s err=%s", table, exc)
        return False
    finally:
        conn.close()
