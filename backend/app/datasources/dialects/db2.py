from __future__ import annotations

import time
from typing import Any

from app.datasources.dialects.base import ColumnInfo, SchemaInfo, TableInfo, TestConnectionResult
from app.datasources.dialects.errors import DB2_DRIVER_MISSING, map_db2_error

DB2_MAX_COLUMNS = 500
_SYSTEM_SCHEMAS = frozenset({"SYSIBM", "SYSCAT", "SYSFUN", "SYSSTAT", "SYSTOOLS"})


class Db2Connector:
    type = "db2"
    category = "relational"
    capabilities = ("connectivity_test", "schema_browser")
    display_name = "IBM Db2"

    def _connect(self, **kwargs: Any) -> Any:
        try:
            import ibm_db_dbi
        except ImportError as exc:
            raise ImportError("ibm_db not installed") from exc
        import ibm_db

        dsn = (
            f"DATABASE={kwargs.get('database', '')};HOSTNAME={kwargs['host']};"
            f"PORT={kwargs.get('port', 50000)};PROTOCOL=TCPIP;UID={kwargs.get('username', '')};"
            f"PWD={kwargs.get('password', '')};"
        )
        conn = ibm_db.connect(dsn, "", "")
        return ibm_db_dbi.Connection(conn)

    def open_connection(self, **kwargs: Any) -> Any:
        return self._connect(**kwargs)

    def test_connection(self, **kwargs: Any) -> TestConnectionResult:
        started = time.perf_counter()
        try:
            conn = self.open_connection(**kwargs)
            try:
                cur = conn.cursor()
                cur.execute("SELECT 1 FROM SYSIBM.SYSDUMMY1")
            finally:
                conn.close()
        except ImportError:
            return TestConnectionResult(
                ok=False,
                message=f"[{DB2_DRIVER_MISSING}] ibm_db not installed",
                latency_ms=0,
                code=DB2_DRIVER_MISSING,
            )
        except Exception as exc:
            code, detail = map_db2_error(exc)
            return TestConnectionResult(
                ok=False,
                message=f"[{code}] {detail}",
                latency_ms=int((time.perf_counter() - started) * 1000),
                code=code,
            )
        return TestConnectionResult(
            ok=True,
            message="Connection successful",
            latency_ms=int((time.perf_counter() - started) * 1000),
            code=None,
        )

    def probe_readonly_sql(self, connection: Any) -> bool:
        connection.execute("SELECT 1 FROM SYSIBM.SYSDUMMY1")
        return True

    def list_schemas(self, connection: Any) -> list[SchemaInfo]:
        cur = connection.cursor()
        cur.execute("SELECT SCHEMANAME FROM SYSCAT.SCHEMATA")
        return [SchemaInfo(name=row[0]) for row in cur.fetchall() if row[0] not in _SYSTEM_SCHEMAS]

    def list_tables(self, connection: Any, schema: str) -> list[TableInfo]:
        if not schema.strip():
            return []
        cur = connection.cursor()
        cur.execute("SELECT TABNAME, TYPE FROM SYSCAT.TABLES WHERE TABSCHEMA = ?", (schema.upper(),))
        return [TableInfo(name=row[0], type=row[1]) for row in cur.fetchall()]

    def list_columns(self, connection: Any, schema: str, table: str) -> list[ColumnInfo]:
        if not schema.strip() or not table.strip():
            return []
        cur = connection.cursor()
        cur.execute(
            "SELECT COLNAME, TYPENAME, NULLS FROM SYSCAT.COLUMNS WHERE TABSCHEMA = ? AND TABNAME = ?",
            (schema.upper(), table.upper()),
        )
        cols = [ColumnInfo(name=r[0], data_type=r[1], nullable=r[2] == "Y") for r in cur.fetchall()]
        return cols[:DB2_MAX_COLUMNS]
