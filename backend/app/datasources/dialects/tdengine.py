from __future__ import annotations

import time
from typing import Any

from app.datasources.dialects.base import ColumnInfo, SchemaInfo, TableInfo, TestConnectionResult
from app.datasources.dialects.errors import TDENGINE_DRIVER_MISSING, map_tdengine_error
from app.query.rls.guard import validate_identifier

TDENGINE_MAX_COLUMNS = 500
_SYSTEM_DBS = frozenset({"information_schema"})


def _quote_ident(name: str) -> str:
    validate_identifier(name)
    return f"`{name}`"


def _import_taos():
    try:
        import taos

        return taos
    except ImportError:
        return None
    except Exception:
        # taospy installed but native libtaos.so missing
        return None


def _connect(**kwargs: Any) -> Any:
    taos = _import_taos()
    if taos is None:
        raise ImportError("taospy not installed")
    return taos.connect(
        host=kwargs["host"],
        port=kwargs.get("port", 6041),
        user=kwargs.get("username", "root"),
        password=kwargs.get("password", ""),
        database=kwargs.get("database", ""),
    )


class TdengineConnector:
    type = "tdengine"
    category = "timeseries"
    capabilities = ("connectivity_test", "schema_browser")
    display_name = "TDengine"

    def test_connection(self, *, host: str, port: int, database: str, username: str, password: str, timeout_sec: float = 5.0, **_: object) -> TestConnectionResult:
        started = time.perf_counter()
        try:
            conn = _connect(host=host, port=port, database=database, username=username, password=password)
            try:
                cur = conn.cursor()
                cur.execute("SELECT server_version()")
                cur.fetchone()
            finally:
                conn.close()
        except ImportError:
            return TestConnectionResult(
                ok=False,
                message=f"[{TDENGINE_DRIVER_MISSING}] taospy not installed",
                latency_ms=0,
                code=TDENGINE_DRIVER_MISSING,
            )
        except Exception as exc:
            code, detail = map_tdengine_error(exc)
            latency_ms = int((time.perf_counter() - started) * 1000)
            return TestConnectionResult(ok=False, message=f"[{code}] {detail}", latency_ms=latency_ms, code=code)
        latency_ms = int((time.perf_counter() - started) * 1000)
        return TestConnectionResult(ok=True, message="Connection successful", latency_ms=latency_ms, code=None)

    def open_connection(self, **kwargs: Any) -> Any:
        return _connect(**kwargs)

    def list_schemas(self, connection: Any) -> list[SchemaInfo]:
        cur = connection.cursor()
        cur.execute("SHOW DATABASES")
        names = [row[0] for row in cur.fetchall() if row[0] not in _SYSTEM_DBS]
        return [SchemaInfo(name=n) for n in sorted(names)]

    def list_tables(self, connection: Any, schema: str) -> list[TableInfo]:
        if not schema.strip():
            return []
        try:
            cur = connection.cursor()
            cur.execute(f"USE {_quote_ident(schema)}")
            cur.execute("SHOW STABLES")
            stables = {row[0]: "stable" for row in cur.fetchall()}
            cur.execute("SHOW TABLES")
            tables = {row[0]: "table" for row in cur.fetchall()}
            merged = {**tables, **stables}
            return [TableInfo(name=n, type=t) for n, t in sorted(merged.items())]
        except Exception:
            return []

    def list_columns(self, connection: Any, schema: str, table: str) -> list[ColumnInfo]:
        if not schema.strip() or not table.strip():
            return []
        try:
            cur = connection.cursor()
            cur.execute(f"DESCRIBE {_quote_ident(schema)}.{_quote_ident(table)}")
            columns = [
                ColumnInfo(name=row[0], data_type=str(row[1]), nullable=True)
                for row in cur.fetchall()
            ]
            # r41: DESCRIBE 结果超 TDENGINE_MAX_COLUMNS 时切片（与 Oracle/ClickHouse 对称）
            return columns[:TDENGINE_MAX_COLUMNS] if len(columns) > TDENGINE_MAX_COLUMNS else columns
        except Exception:
            return []
