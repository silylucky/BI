from __future__ import annotations

import time
from typing import Any

from app.datasources.dialects.base import ColumnInfo, SchemaInfo, TableInfo, TestConnectionResult
from app.datasources.dialects.errors import DM_DRIVER_MISSING, map_dm_error

DM_MAX_COLUMNS = 500
_SYSTEM_OWNERS = frozenset({"SYS", "SYSDBA"})


def _redact_secrets(message: str, password: str | None) -> str:
    if password and password in message:
        return message.replace(password, "***")
    return message


class DmConnector:
    type = "dm"
    category = "relational"
    capabilities = ("connectivity_test", "schema_browser")
    display_name = "达梦 DM"

    def _connect(self, **kwargs: Any) -> Any:
        try:
            import dmPython
        except ImportError as exc:
            raise ImportError("dmPython driver not installed") from exc
        return dmPython.connect(
            user=kwargs["username"],
            password=kwargs["password"],
            server=kwargs["host"],
            port=kwargs.get("port", 5236),
        )

    def open_connection(self, **kwargs: Any) -> Any:
        return self._connect(**kwargs)

    def test_connection(self, **kwargs: Any) -> TestConnectionResult:
        started = time.perf_counter()
        try:
            connection = self._connect(**kwargs)
            try:
                cursor = connection.cursor()
                cursor.execute("SELECT 1 FROM DUAL")
            finally:
                connection.close()
        except ImportError:
            latency_ms = int((time.perf_counter() - started) * 1000)
            return TestConnectionResult(
                ok=False,
                message=f"[{DM_DRIVER_MISSING}] dmPython driver not installed",
                latency_ms=latency_ms,
                code=DM_DRIVER_MISSING,
            )
        except Exception as exc:
            code, detail = map_dm_error(exc)
            detail = _redact_secrets(detail, kwargs.get("password"))
            latency_ms = int((time.perf_counter() - started) * 1000)
            return TestConnectionResult(
                ok=False, message=f"[{code}] {detail}", latency_ms=latency_ms, code=code,
            )
        latency_ms = int((time.perf_counter() - started) * 1000)
        return TestConnectionResult(ok=True, message="Connection successful", latency_ms=latency_ms, code=None)

    def list_schemas(self, connection: Any) -> list[SchemaInfo]:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT DISTINCT OWNER FROM ALL_TABLES
            WHERE OWNER NOT IN ('SYS','SYSDBA')
            ORDER BY 1
            """
        )
        return [
            SchemaInfo(name=row[0])
            for row in cursor.fetchall()
            if row and row[0] not in _SYSTEM_OWNERS
        ]

    def list_tables(self, connection: Any, schema: str) -> list[TableInfo]:
        if not schema.strip():
            return []
        cursor = connection.cursor()
        cursor.execute(
            "SELECT TABLE_NAME, 'TABLE' FROM ALL_TABLES WHERE OWNER = ? ORDER BY 1",
            (schema.upper(),),
        )
        rows = cursor.fetchall()
        return [TableInfo(name=row[0], type=row[1]) for row in rows if row] if rows else []

    def list_columns(self, connection: Any, schema: str, table: str) -> list[ColumnInfo]:
        if not schema.strip() or not table.strip():
            return []
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT COLUMN_NAME, DATA_TYPE, NULLABLE
            FROM ALL_TAB_COLUMNS
            WHERE OWNER = ? AND TABLE_NAME = ?
            ORDER BY COLUMN_ID
            """,
            (schema.upper(), table.upper()),
        )
        columns = [
            ColumnInfo(name=row[0], data_type=row[1], nullable=str(row[2]) == "Y")
            for row in cursor.fetchall()
            if row
        ]
        return columns[:DM_MAX_COLUMNS] if len(columns) > DM_MAX_COLUMNS else columns

    def probe_readonly_sql(self, connection: Any) -> bool:
        """Execute minimal read-only probe; return True on success."""
        cursor = connection.cursor()
        cursor.execute("SELECT 1 FROM DUAL")
        return True
