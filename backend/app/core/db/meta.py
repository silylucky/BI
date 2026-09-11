from __future__ import annotations

from functools import lru_cache
from typing import Literal

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import get_settings

MetaDialect = Literal["postgresql", "mysql", "sqlite"]

_SUPPORTED_PREFIXES = (
    "postgresql://",
    "postgresql+psycopg://",
    "mysql://",
    "mysql+pymysql://",
    "sqlite+",
)


def detect_meta_dialect(url: str) -> MetaDialect:
    if url.startswith("sqlite"):
        return "sqlite"
    if url.startswith(("mysql://", "mysql+pymysql://")):
        return "mysql"
    if url.startswith(("postgresql://", "postgresql+psycopg://")):
        return "postgresql"
    raise ValueError(f"unsupported platform meta database url: {url.split(':', 1)[0]}")


def normalize_meta_database_url(url: str) -> str:
    stripped = url.strip()
    if stripped.startswith("mysql://"):
        return "mysql+pymysql://" + stripped[len("mysql://") :]
    return stripped


def _meta_connect_args(url: str) -> dict:
    dialect = detect_meta_dialect(url)
    if dialect == "sqlite":
        return {"check_same_thread": False}
    if dialect == "postgresql":
        return {"connect_timeout": 5}
    return {"charset": "utf8mb4"}


@lru_cache
def get_meta_engine():
    url = normalize_meta_database_url(get_settings().database_url)
    return create_engine(
        url,
        pool_pre_ping=True,
        connect_args=_meta_connect_args(url),
    )


def get_meta_session():
    return sessionmaker(bind=get_meta_engine(), autoflush=False, autocommit=False)()
