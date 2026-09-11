from __future__ import annotations

import os
import sqlite3
import time
from pathlib import Path
from typing import Any

from app.datasources.dialects.base import ColumnInfo, SchemaInfo, TableInfo, TestConnectionResult
from app.datasources.dialects.errors import (
    SQLITE_FILE_NOT_FOUND,
    SQLITE_PATH_TRAVERSAL,
    SQLITE_PERMISSION_DENIED,
    map_sqlite_error,
)

SQLITE_MAX_COLUMNS = 500


def _validate_db_path(host: str) -> tuple[Path | None, str | None]:
    if ".." in host.replace("\\", "/").split("/"):
        return None, SQLITE_PATH_TRAVERSAL
    path = Path(host).expanduser().resolve()
    if not path.is_file():
        return None, SQLITE_FILE_NOT_FOUND
    if not os.access(path, os.R_OK):
        return None, SQLITE_PERMISSION_DENIED
    return path, None


class SqliteConnector:
    """SQLite 文件型源：host=文件系统路径，port 忽略（存 1 满足校验）。"""

    type = "sqlite"
    category = "embedded"
    capabilities = ("connectivity_test", "schema_browser")
    display_name = "SQLite"

    def test_connection(self, *, host: str, port: int, database: str, username: str, password: str, timeout_sec: float = 5.0, **_: object) -> TestConnectionResult:
        started = time.perf_counter()
        path, err_code = _validate_db_path(host)
        if err_code:
            latency_ms = int((time.perf_counter() - started) * 1000)
            return TestConnectionResult(ok=False, message=f"[{err_code}] invalid sqlite path", latency_ms=latency_ms, code=err_code)
        try:
            conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
            try:
                conn.execute("SELECT 1")
            finally:
                conn.close()
        except Exception as exc:
            code, detail = map_sqlite_error(exc)
            latency_ms = int((time.perf_counter() - started) * 1000)
            return TestConnectionResult(ok=False, message=f"[{code}] {detail}", latency_ms=latency_ms, code=code)
        latency_ms = int((time.perf_counter() - started) * 1000)
        return TestConnectionResult(ok=True, message="Connection successful", latency_ms=latency_ms, code=None)

    # r41: open_connection 与 test_connection 共用 _validate_db_path；只读 OperationalError → SQLITE_READONLY
    def open_connection(self, **kwargs: Any) -> Any:
        path, err_code = _validate_db_path(kwargs["host"])
        if err_code or path is None:
            raise ValueError(err_code or SQLITE_FILE_NOT_FOUND)
        return sqlite3.connect(f"file:{path}?mode=ro", uri=True)

    def list_schemas(self, connection: Any) -> list[SchemaInfo]:
        return [SchemaInfo(name="main")]

    def list_tables(self, connection: Any, schema: str) -> list[TableInfo]:
        if not schema.strip():
            return []
        cur = connection.execute(
            "SELECT name, type FROM sqlite_master "
            "WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY name"
        )
        return [TableInfo(name=row[0], type=row[1]) for row in cur.fetchall()]

    def list_columns(self, connection: Any, schema: str, table: str) -> list[ColumnInfo]:
        if not schema.strip() or not table.strip():
            return []
        try:
            cur = connection.execute(f'PRAGMA table_info("{table}")')
            columns = [
                ColumnInfo(name=row[1], data_type=str(row[2]), nullable=not bool(row[3]))
                for row in cur.fetchall()
            ]
            return columns[:SQLITE_MAX_COLUMNS] if len(columns) > SQLITE_MAX_COLUMNS else columns
        except sqlite3.Error:
            return []
