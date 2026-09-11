from __future__ import annotations

import time
from typing import Any, Literal

import psycopg

from app.core.config import get_settings
from app.datasources.dialects.base import (
    ColumnInfo,
    SchemaInfo,
    TableInfo,
    TestConnectionResult,
)
from app.datasources.dialects.errors import map_postgres_operational_error, pg_sslmode

_SSL_MODES = frozenset({"disabled", "preferred", "required"})


class PostgresConnector:
    type = "postgresql"
    category = "relational"
    capabilities = ("connectivity_test", "schema_browser")
    display_name = "PostgreSQL"

    def _connect_kwargs(
        self,
        *,
        host: str,
        port: int,
        database: str,
        username: str,
        password: str,
        connect_timeout_sec: float,
        ssl_mode: str,
    ) -> dict:
        settings = get_settings()
        clamped = max(1.0, min(float(connect_timeout_sec), float(min(30, settings.query_timeout_seconds))))
        return {
            "host": host,
            "port": port,
            "dbname": database,
            "user": username,
            "password": password,
            "connect_timeout": int(clamped),
            "sslmode": pg_sslmode(ssl_mode),
        }

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
        read_timeout_sec: float | None = None,
    ) -> Any:
        if ssl_mode not in _SSL_MODES:
            raise ValueError(f"invalid ssl_mode: {ssl_mode}")
        kwargs = self._connect_kwargs(
            host=host, port=port, database=database, username=username, password=password,
            connect_timeout_sec=connect_timeout_sec, ssl_mode=ssl_mode,
        )
        if read_timeout_sec is not None:
            ms = int(read_timeout_sec * 1000)
            kwargs["options"] = f"-c statement_timeout={ms}"
        return psycopg.connect(**kwargs)

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
        raw = connect_timeout_sec if connect_timeout_sec is not None else timeout_sec
        started = time.perf_counter()
        try:
            conn = self.open_connection(
                host=host, port=port, database=database, username=username, password=password,
                connect_timeout_sec=raw, ssl_mode=ssl_mode,
            )
            try:
                conn.execute("SELECT 1")
            finally:
                conn.close()
        except psycopg.OperationalError as exc:
            code, detail = map_postgres_operational_error(exc)
            latency_ms = int((time.perf_counter() - started) * 1000)
            return TestConnectionResult(ok=False, message=f"[{code}] {detail}", latency_ms=latency_ms, code=code)
        except Exception as exc:
            latency_ms = int((time.perf_counter() - started) * 1000)
            return TestConnectionResult(ok=False, message=str(exc), latency_ms=latency_ms, code=None)
        latency_ms = int((time.perf_counter() - started) * 1000)
        return TestConnectionResult(ok=True, message="Connection successful", latency_ms=latency_ms, code=None)

    def list_schemas(self, connection: Any) -> list[SchemaInfo]:
        with connection.cursor() as cur:
            cur.execute(
                "SELECT schema_name FROM information_schema.schemata "
                "WHERE schema_name NOT IN ('pg_catalog','information_schema') ORDER BY 1"
            )
            return [SchemaInfo(name=row[0]) for row in cur.fetchall()]

    def list_tables(self, connection: Any, schema: str) -> list[TableInfo]:
        with connection.cursor() as cur:
            cur.execute(
                "SELECT table_name, table_type FROM information_schema.tables "
                "WHERE table_schema = %s AND table_type IN ('BASE TABLE','VIEW') ORDER BY 1",
                (schema,),
            )
            return [
                TableInfo(name=row[0], type="view" if row[1] == "VIEW" else "table")
                for row in cur.fetchall()
            ]

    def list_columns(self, connection: Any, schema: str, table: str) -> list[ColumnInfo]:
        with connection.cursor() as cur:
            cur.execute(
                "SELECT column_name, data_type, is_nullable FROM information_schema.columns "
                "WHERE table_schema = %s AND table_name = %s ORDER BY ordinal_position",
                (schema, table),
            )
            return [
                ColumnInfo(name=row[0], data_type=row[1], nullable=row[2] == "YES")
                for row in cur.fetchall()
            ]
