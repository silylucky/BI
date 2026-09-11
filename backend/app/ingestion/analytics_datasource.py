"""开发环境托管分析库数据源自动登记（对标 demo-mysql 模式）。"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from urllib.parse import urlparse

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.datasources.dialects.postgres import PostgresConnector
from app.datasources.models import DataSource
from app.datasources.schemas import DataSourceCreate
from app.datasources.service import create_data_source

logger = logging.getLogger(__name__)

OFFICIAL_ANALYTICS_DATASOURCE_CODE = "analytics"
ANALYTICS_DATASOURCE_NAME = "托管分析库"

_DEFAULT_HOST = "127.0.0.1"
_DEFAULT_PORT = 5433
_DEFAULT_DATABASE = "analytics"
_DEFAULT_USERNAME = "vitalspan"
_DEFAULT_PASSWORD = "vitalspan"


@dataclass(frozen=True)
class AnalyticsPgConnection:
    host: str
    port: int
    database: str
    username: str
    password: str


def resolve_analytics_connection() -> AnalyticsPgConnection | None:
    settings = get_settings()
    raw = (settings.analytics_database_url or "").strip()
    if not raw:
        return None
    parsed = urlparse(raw)
    if parsed.scheme not in {"postgresql", "postgresql+psycopg"}:
        return None
    return AnalyticsPgConnection(
        host=parsed.hostname or _DEFAULT_HOST,
        port=parsed.port or _DEFAULT_PORT,
        database=(parsed.path or "").lstrip("/") or _DEFAULT_DATABASE,
        username=parsed.username or _DEFAULT_USERNAME,
        password=parsed.password or _DEFAULT_PASSWORD,
    )


def can_connect_analytics_pg(conn: AnalyticsPgConnection | None = None) -> bool:
    resolved = conn or resolve_analytics_connection()
    if resolved is None:
        return False
    connector = PostgresConnector()
    try:
        result = connector.test_connection(
            host=resolved.host,
            port=resolved.port,
            database=resolved.database,
            username=resolved.username,
            password=resolved.password,
            timeout_sec=3.0,
        )
        return bool(result.ok)
    except Exception:
        return False


def is_managed_analytics_datasource(db: Session, ds_id: uuid.UUID) -> bool:
    """托管分析库：code=analytics 或 5433/analytics 的 PG。"""
    row = db.get(DataSource, ds_id)
    if row is None or row.deleted_at is not None:
        return False
    if row.code == OFFICIAL_ANALYTICS_DATASOURCE_CODE:
        return True
    return (
        row.type in ("postgresql", "postgres")
        and row.port == 5433
        and row.database == "analytics"
    )


def resolve_analytics_datasource_id(db: Session) -> uuid.UUID | None:
    """查找已登记的托管分析库（5433/analytics PostgreSQL）。"""
    rows = db.scalars(
        select(DataSource).where(
            DataSource.deleted_at.is_(None),
            DataSource.type.in_(("postgresql", "postgres")),
            DataSource.port == 5433,
            DataSource.database == "analytics",
        )
    ).all()
    if not rows:
        by_code = db.scalar(
            select(DataSource).where(
                DataSource.code == OFFICIAL_ANALYTICS_DATASOURCE_CODE,
                DataSource.deleted_at.is_(None),
            )
        )
        return by_code.id if by_code else None
    if len(rows) == 1:
        return rows[0].id
    for row in rows:
        if row.code == OFFICIAL_ANALYTICS_DATASOURCE_CODE:
            return row.id
    return rows[0].id


def ensure_analytics_datasource(db: Session) -> uuid.UUID | None:
    """幂等创建/确认托管分析库 PG 连接；不可达时 skip。"""
    conn = resolve_analytics_connection()
    if conn is None:
        logger.info("analytics_datasource_skip analytics_database_url unset")
        return resolve_analytics_datasource_id(db)

    existing = db.scalar(
        select(DataSource).where(
            DataSource.code == OFFICIAL_ANALYTICS_DATASOURCE_CODE,
            DataSource.deleted_at.is_(None),
        )
    )
    if existing is not None:
        if can_connect_analytics_pg(conn):
            existing.name = ANALYTICS_DATASOURCE_NAME
            existing.host = conn.host
            existing.port = conn.port
            existing.database = conn.database
            existing.username = conn.username
            db.commit()
        return existing.id

    resolved_id = resolve_analytics_datasource_id(db)
    if resolved_id is not None:
        return resolved_id

    if not can_connect_analytics_pg(conn):
        logger.info(
            "analytics_datasource_skip unreachable host=%s port=%s",
            conn.host,
            conn.port,
        )
        return None

    try:
        out = create_data_source(
            db,
            DataSourceCreate(
                name=ANALYTICS_DATASOURCE_NAME,
                code=OFFICIAL_ANALYTICS_DATASOURCE_CODE,
                type="postgresql",
                host=conn.host,
                port=conn.port,
                database=conn.database,
                username=conn.username,
                password=conn.password,
                description="托管 PostgreSQL 分析库，供同步入湖后的 Dataset 与看板消费。",
            ),
        )
        logger.info("analytics_datasource_created id=%s", out.id)
        return out.id
    except Exception:
        logger.warning("analytics_datasource_create_failed", exc_info=True)
        return resolve_analytics_datasource_id(db)
