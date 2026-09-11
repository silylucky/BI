from __future__ import annotations

import csv
import os
import tempfile
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Any

import httpx

from app.datasources.dialects.base import ColumnInfo, SchemaInfo, TableInfo, TestConnectionResult
from app.datasources.dialects.errors import (
    FILE_EXTENSION_DENIED,
    FILE_NOT_FOUND,
    FILE_PATH_TRAVERSAL,
    map_file_error,
)
from app.query.native.guard import guard_native_injection

ALLOWED_CSV_SUFFIX = ".csv"


def _resolve_csv_path(host: str) -> tuple[Path | None, str | None, bool]:
    if host.startswith("https://"):
        return None, None, True
    if ".." in host.replace("\\", "/").split("/"):
        return None, FILE_PATH_TRAVERSAL, False
    path = Path(host).expanduser().resolve()
    if path.suffix.lower() != ALLOWED_CSV_SUFFIX:
        return None, FILE_EXTENSION_DENIED, False
    if not path.is_file() or not os.access(path, os.R_OK):
        return None, FILE_NOT_FOUND, False
    return path, None, False


def _read_csv_rows(path: Path) -> tuple[list[str], list[list]]:
    with path.open(encoding="utf-8", newline="") as fh:
        sample = fh.read(4096)
        fh.seek(0)
        try:
            dialect = csv.Sniffer().sniff(sample)
        except csv.Error:
            dialect = csv.excel
        reader = csv.reader(fh, dialect)
        rows = list(reader)
    if not rows:
        return [], []
    header = [str(c) for c in rows[0]]
    data = [list(r) for r in rows[1:]]
    return header, data


def _resolve_connection_path(connection: Any) -> Path:
    if isinstance(connection, dict) and connection.get("remote"):
        url = str(connection["remote"])
        with httpx.Client(timeout=30.0, follow_redirects=True) as client:
            resp = client.get(url)
            resp.raise_for_status()
        fd, name = tempfile.mkstemp(suffix=ALLOWED_CSV_SUFFIX)
        with os.fdopen(fd, "wb") as fh:
            fh.write(resp.content)
        return Path(name)
    if isinstance(connection, Path):
        return connection
    raise ValueError(FILE_NOT_FOUND)


@contextmanager
def _open_csv_path(connection: Any):
    temp_path: Path | None = None
    try:
        if isinstance(connection, dict) and connection.get("remote"):
            path = _resolve_connection_path(connection)
            temp_path = path
            yield path
        elif isinstance(connection, Path):
            yield connection
        else:
            raise ValueError(FILE_NOT_FOUND)
    finally:
        if temp_path is not None:
            try:
                os.unlink(temp_path)
            except OSError:
                pass


class CsvFileConnector:
    type = "csv"
    category = "file"
    capabilities = ("connectivity_test", "schema_browser", "native_query")
    display_name = "CSV"

    def test_connection(self, **kwargs: Any) -> TestConnectionResult:
        started = time.perf_counter()
        path, err, is_remote = _resolve_csv_path(kwargs["host"])
        if is_remote:
            try:
                with httpx.Client(timeout=float(kwargs.get("timeout_sec", 5.0)), follow_redirects=True) as client:
                    resp = client.head(kwargs["host"])
                if not resp.is_success:
                    code, detail = map_file_error(Exception(f"remote http {resp.status_code}"))
                    return TestConnectionResult(ok=False, message=f"[{code}] {detail}", latency_ms=0, code=code)
            except Exception as exc:
                code, detail = map_file_error(exc)
                return TestConnectionResult(ok=False, message=f"[{code}] {detail}", latency_ms=0, code=code)
            return TestConnectionResult(
                ok=True,
                message="Remote file reachable",
                latency_ms=int((time.perf_counter() - started) * 1000),
                code=None,
            )
        if err:
            return TestConnectionResult(ok=False, message=f"[{err}] invalid path", latency_ms=0, code=err)
        try:
            _read_csv_rows(path)
        except Exception as exc:
            code, detail = map_file_error(exc)
            return TestConnectionResult(ok=False, message=f"[{code}] {detail}", latency_ms=0, code=code)
        return TestConnectionResult(
            ok=True,
            message="Connection successful",
            latency_ms=int((time.perf_counter() - started) * 1000),
            code=None,
        )

    def open_connection(self, **kwargs: Any) -> Any:
        path, err, is_remote = _resolve_csv_path(kwargs["host"])
        if is_remote:
            return {"remote": kwargs["host"]}
        if err or path is None:
            raise ValueError(err or FILE_NOT_FOUND)
        return path

    def list_schemas(self, connection: Any) -> list[SchemaInfo]:
        return [SchemaInfo(name="file")]

    def list_tables(self, connection: Any, schema: str) -> list[TableInfo]:
        return [TableInfo(name="data", type="TABLE")]

    def list_columns(self, connection: Any, schema: str, table: str) -> list[ColumnInfo]:
        with _open_csv_path(connection) as path:
            header, _ = _read_csv_rows(path)
        return [ColumnInfo(name=c, data_type="string", nullable=True) for c in header]

    def execute_native_query(
        self,
        connection: Any,
        *,
        body: dict,
        limit: int,
        offset: int = 0,
        database: str | None = None,
    ) -> tuple[list[str], list[list], bool]:
        guard_native_injection(body)
        with _open_csv_path(connection) as path:
            header, data = _read_csv_rows(path)
        data = data[offset : offset + limit + 1]
        truncated = len(data) > limit
        return header, data[:limit], truncated
