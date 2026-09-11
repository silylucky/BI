from __future__ import annotations

from app.query.capabilities import resolve_sql_dialect_type
from app.query.dialects.base import SqlDialect, UnsupportedDialectError
from app.query.dialects.clickhouse import ClickHouseDialect
from app.query.dialects.db2 import Db2Dialect
from app.query.dialects.hive import HiveDialect
from app.query.dialects.mysql import MySqlDialect
from app.query.dialects.oracle import OracleDialect
from app.query.dialects.postgres import PostgresDialect
from app.query.dialects.roapi import RoapiDialect
from app.query.dialects.sqlite import SqliteDialect
from app.query.dialects.sqlserver import SqlServerDialect
from app.query.dialects.tdengine import TdengineDialect
from app.query.dialects.trino import TrinoDialect

_REGISTRY: dict[str, SqlDialect] = {
    "mysql": MySqlDialect(),
    "postgresql": PostgresDialect(),
    "clickhouse": ClickHouseDialect(),
    "sqlite": SqliteDialect(),
    "sqlserver": SqlServerDialect(),
    "oracle": OracleDialect(),
    "hive": HiveDialect(),
    "trino": TrinoDialect(),
    "db2": Db2Dialect(),
    "tdengine": TdengineDialect(),
    "roapi": RoapiDialect(),
}


def get_sql_dialect(connector_type: str) -> SqlDialect:
    resolved = resolve_sql_dialect_type(connector_type)
    dialect = _REGISTRY.get(resolved)
    if dialect is None:
        raise UnsupportedDialectError(connector_type)
    return dialect


__all__ = [
    "SqlDialect",
    "UnsupportedDialectError",
    "MySqlDialect",
    "PostgresDialect",
    "ClickHouseDialect",
    "SqliteDialect",
    "SqlServerDialect",
    "OracleDialect",
    "HiveDialect",
    "TrinoDialect",
    "Db2Dialect",
    "TdengineDialect",
    "RoapiDialect",
    "get_sql_dialect",
]
