from __future__ import annotations

import re
import time
from typing import Any, Literal

import pymysql
import pymysql.err

from app.core.config import get_settings
from app.datasources.dialects.base import ColumnInfo, SchemaInfo, TableInfo, TestConnectionResult
from app.datasources.dialects.errors import map_mysql_operational_error

_SSL_MODES = frozenset({"disabled", "preferred", "required"})
_COLLATION_RE = re.compile(r"^[\w-]+$")


def _collation_init_command(charset: str, collation: str | None) -> str | None:
    if collation is None:
        return None
    if not _COLLATION_RE.match(charset) or not _COLLATION_RE.match(collation):
        raise ValueError(f"invalid charset/collation: {charset}/{collation}")
    return f"SET NAMES {charset} COLLATE {collation}"


class MysqlConnector:
    type = "mysql"
    category = "relational"
    capabilities = ("connectivity_test", "schema_browser")
    display_name = "MySQL"

    def _build_connect_kwargs(
        self,
        *,
        host: str,
        port: int,
        database: str,
        username: str,
        password: str,
        connect_timeout_sec: float = 5.0,
        ssl_mode: str = "preferred",
        charset: str = "utf8mb4",
        collation: str | None = None,
        read_timeout_sec: float | None = None,
    ) -> dict:
        if ssl_mode not in _SSL_MODES:
            raise ValueError(f"invalid ssl_mode: {ssl_mode}")
        settings = get_settings()
        clamped_connect = max(1.0, min(float(connect_timeout_sec), float(min(30, settings.query_timeout_seconds))))
        connect_timeout = int(clamped_connect)
        read_raw = read_timeout_sec if read_timeout_sec is not None else clamped_connect
        clamped_read = max(1.0, min(float(read_raw), float(min(30, settings.query_timeout_seconds))))
        read_timeout = int(clamped_read)
        connect_kwargs: dict = {
            "host": host,
            "port": port,
            "user": username,
            "password": password,
            "database": database,
            "charset": charset,
            "connect_timeout": connect_timeout,
            "read_timeout": read_timeout,
            "write_timeout": connect_timeout,
        }
        init_cmd = _collation_init_command(charset, collation)
        if init_cmd:
            connect_kwargs["init_command"] = init_cmd
        if ssl_mode == "required":
            connect_kwargs["ssl"] = {}
        elif ssl_mode == "disabled":
            connect_kwargs["ssl_disabled"] = True
        return connect_kwargs

    def open_connection(
        self,
        *,
        host: str,
        port: int,
        database: str,
        username: str,
        password: str,
        connect_timeout_sec: float = 5.0,
        ssl_mode: str = "preferred",
        charset: str = "utf8mb4",
        collation: str | None = None,
        read_timeout_sec: float | None = None,
    ) -> Any:
        kwargs = self._build_connect_kwargs(
            host=host,
            port=port,
            database=database,
            username=username,
            password=password,
            connect_timeout_sec=connect_timeout_sec,
            ssl_mode=ssl_mode,
            charset=charset,
            collation=collation,
            read_timeout_sec=read_timeout_sec,
        )
        return pymysql.connect(**kwargs)

    def test_connection(
        self,
        *,
        host: str,
        port: int,
        database: str,
        username: str,
        password: str,
        timeout_sec: float = 5.0,
        charset: str = "utf8mb4",
        collation: str | None = None,
        ssl_mode: Literal["disabled", "preferred", "required"] = "preferred",
        connect_timeout_sec: float | None = None,
        read_timeout_sec: float | None = None,
    ) -> TestConnectionResult:
        connect_raw = connect_timeout_sec if connect_timeout_sec is not None else timeout_sec
        connect_kwargs = self._build_connect_kwargs(
            host=host,
            port=port,
            database=database,
            username=username,
            password=password,
            connect_timeout_sec=connect_raw,
            ssl_mode=ssl_mode,
            charset=charset,
            collation=collation,
            read_timeout_sec=read_timeout_sec,
        )
        started = time.perf_counter()
        try:
            connection = pymysql.connect(**connect_kwargs)
            try:
                connection.ping(reconnect=False)
            finally:
                connection.close()
        except pymysql.err.OperationalError as exc:
            code, detail = map_mysql_operational_error(exc)
            latency_ms = int((time.perf_counter() - started) * 1000)
            return TestConnectionResult(
                ok=False,
                message=f"[{code}] {detail}",
                latency_ms=latency_ms,
                code=code,
            )
        except Exception as exc:
            latency_ms = int((time.perf_counter() - started) * 1000)
            return TestConnectionResult(ok=False, message=str(exc), latency_ms=latency_ms, code=None)
        latency_ms = int((time.perf_counter() - started) * 1000)
        return TestConnectionResult(ok=True, message="Connection successful", latency_ms=latency_ms, code=None)

    def list_schemas(self, connection: Any) -> list[SchemaInfo]:
        with connection.cursor() as cur:
            cur.execute("SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA ORDER BY 1")
            return [SchemaInfo(name=row[0]) for row in cur.fetchall()]

    def list_tables(self, connection: Any, schema: str) -> list[TableInfo]:
        with connection.cursor() as cur:
            cur.execute(
                "SELECT TABLE_NAME, TABLE_TYPE FROM INFORMATION_SCHEMA.TABLES "
                "WHERE TABLE_SCHEMA = %s ORDER BY 1",
                (schema,),
            )
            return [
                TableInfo(name=row[0], type="view" if row[1] == "VIEW" else "table")
                for row in cur.fetchall()
            ]

    def list_columns(self, connection: Any, schema: str, table: str) -> list[ColumnInfo]:
        with connection.cursor() as cur:
            cur.execute(
                "SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS "
                "WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s ORDER BY ORDINAL_POSITION",
                (schema, table),
            )
            return [
                ColumnInfo(name=row[0], data_type=row[1], nullable=row[2] == "YES")
                for row in cur.fetchall()
            ]
