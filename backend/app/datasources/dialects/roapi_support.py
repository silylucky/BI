from __future__ import annotations

import re
from typing import Any
from urllib.parse import quote, urlparse

import httpx

from app.datasources.dialects.base import ColumnInfo
from app.datasources.dialects.errors import ROAPI_AUTH_FAILED, ROAPI_PROBE_FAILED, ROAPI_TABLE_NOT_FOUND
from app.query.schemas import QueryError

ROAPI_MAX_COLUMNS = 500
ROAPI_DEFAULT_PORT = 8080
ROAPI_SCHEMA_PATH = "/api/schema"
ROAPI_SQL_PATH = "/api/sql"
_LIMIT_RE = re.compile(r"\blimit\b", re.IGNORECASE)


def normalize_base_url(host: str, port: int) -> str:
    host = host.strip().rstrip("/")
    if host.startswith("http://") or host.startswith("https://"):
        return host
    scheme = "https" if port == 443 else "http"
    if "://" in host:
        return host
    if port in (80, 443):
        return f"{scheme}://{host}"
    return f"{scheme}://{host}:{port}"


def resolve_schema_path(database: str | None) -> str:
    raw = (database or "").strip() or ROAPI_SCHEMA_PATH
    return raw if raw.startswith("/") else f"/{raw}"


def schema_path_from_client(client: httpx.Client) -> str:
    path = getattr(client, "_vs_roapi_schema_path", None)
    if isinstance(path, str) and path.strip():
        return path
    return ROAPI_SCHEMA_PATH


def client_kwargs(kwargs: Any) -> dict[str, Any]:
    base = normalize_base_url(kwargs["host"], int(kwargs.get("port", ROAPI_DEFAULT_PORT)))
    username = kwargs.get("username") or ""
    password = kwargs.get("password") or ""
    timeout = float(kwargs.get("timeout_sec", 5.0))
    headers: dict[str, str] | None = None
    auth: tuple[str, str] | None = None
    if username == "bearer" and password:
        headers = {"Authorization": f"Bearer {password}"}
    elif username and username not in ("none", "bearer"):
        auth = (username, password)
    return {"base_url": base, "headers": headers, "auth": auth, "timeout": timeout}


def request_json(client: httpx.Client, method: str, path: str, **kwargs: Any) -> object:
    resp = client.request(method, path, **kwargs)
    if resp.status_code == 401:
        raise QueryError(ROAPI_AUTH_FAILED, "Unauthorized", 401)
    if resp.status_code == 404:
        raise QueryError(ROAPI_TABLE_NOT_FOUND, f"Not found: {path}", 404)
    if not resp.is_success:
        raise QueryError(ROAPI_PROBE_FAILED, f"HTTP {resp.status_code}", 400)
    if not resp.content:
        return {}
    return resp.json()


def table_names(payload: object) -> list[str]:
    if isinstance(payload, dict):
        if "tables" in payload and isinstance(payload["tables"], list):
            return [str(item) for item in payload["tables"]]
        return sorted(str(key) for key in payload.keys() if not key.startswith("_"))
    if isinstance(payload, list):
        return [str(item) for item in payload]
    return []


def columns_for_table(payload: object, table: str) -> list[ColumnInfo]:
    if isinstance(payload, dict) and table in payload:
        return columns_from_schema(payload[table])
    return []


def columns_from_schema(payload: object) -> list[ColumnInfo]:
    fields: list[object] = []
    if isinstance(payload, dict):
        raw_fields = payload.get("fields")
        if isinstance(raw_fields, list):
            fields = raw_fields
        elif isinstance(raw_fields, dict):
            fields = list(raw_fields.values())
    columns: list[ColumnInfo] = []
    for field in fields[:ROAPI_MAX_COLUMNS]:
        if isinstance(field, dict):
            name = field.get("name")
            if isinstance(name, str) and name:
                dtype = next(
                    (field.get(key) for key in ("data_type", "dataType", "type") if isinstance(field.get(key), str)),
                    "string",
                )
                columns.append(ColumnInfo(name=name, data_type=str(dtype), nullable=True))
    return columns


def payload_to_rows(payload: object, *, limit: int, offset: int) -> tuple[list[str], list[list], bool]:
    rows_source: list[dict[str, object]] = []
    if isinstance(payload, list):
        rows_source = [item for item in payload if isinstance(item, dict)]
    elif isinstance(payload, dict):
        for key in ("data", "rows", "records", "items"):
            candidate = payload.get(key)
            if isinstance(candidate, list):
                rows_source = [item for item in candidate if isinstance(item, dict)]
                break
    if not rows_source:
        return [], [], False
    slice_items = rows_source[offset : offset + limit + 1]
    columns = sorted({key for item in slice_items for key in item})[:ROAPI_MAX_COLUMNS]
    rows = [[item.get(col) for col in columns] for item in slice_items]
    truncated = len(rows) > limit
    return columns, rows[:limit], truncated


def apply_limit_offset(sql: str, *, limit: int, offset: int) -> str:
    normalized = sql.strip().rstrip(";")
    if _LIMIT_RE.search(normalized):
        return normalized
    return f"{normalized} LIMIT {limit} OFFSET {offset}"


def validate_base_url(host: str, port: int) -> None:
    base = normalize_base_url(host, port)
    if not urlparse(base).scheme:
        raise ValueError("invalid url: missing scheme")
