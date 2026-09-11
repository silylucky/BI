from __future__ import annotations

import json
import time
from typing import Any
from urllib.parse import urlparse

import httpx

from app.datasources.dialects.base import ColumnInfo, SchemaInfo, TableInfo, TestConnectionResult
from app.datasources.dialects.errors import (
    REST_API_AUTH_FAILED,
    REST_API_INVALID_URL,
    REST_API_PROBE_FAILED,
    map_rest_api_error,
)
from app.query.native.guard import guard_native_injection
from app.query.schemas import QueryError
from app.sample_api.internal import SampleApiAuthError, dispatch_sample_api_get

REST_API_MAX_COLUMNS = 500

_LOCAL_VITALSPAN_PORTS = frozenset({8000, 80})


def _is_local_vitalspan_base(base: str) -> bool:
    parsed = urlparse(base)
    host = (parsed.hostname or "").lower()
    if host not in ("127.0.0.1", "localhost", "::1"):
        return False
    port = parsed.port
    if port is None:
        port = 443 if parsed.scheme == "https" else 80
    return port in _LOCAL_VITALSPAN_PORTS


def _is_sample_api_path(path: str) -> bool:
    normalized = path if path.startswith("/") else f"/{path}"
    return normalized == "/sample-api" or normalized.startswith("/sample-api/")


def _normalize_probe_path(probe: str) -> str:
    return probe if probe.startswith("/") else f"/{probe}"


def _auth_credentials(auth: object | None) -> tuple[str | None, str | None]:
    if auth is None:
        return None, None
    if isinstance(auth, tuple) and len(auth) == 2:
        username, password = auth
        return str(username), str(password)
    return None, None


def _fetch_sample_api_payload(
    path: str,
    auth: object | None,
) -> object:
    username, password = _auth_credentials(auth)
    try:
        return dispatch_sample_api_get(path, username=username, password=password)
    except SampleApiAuthError as exc:
        raise QueryError(REST_API_AUTH_FAILED, "Unauthorized", 401) from exc


def _payload_to_rows(payload: object, *, limit: int, offset: int, json_path: str | None) -> tuple[list[str], list[list], bool]:
    if json_path and isinstance(payload, dict):
        payload = payload.get(json_path, [])
    if isinstance(payload, dict):
        columns = sorted(payload.keys())[:REST_API_MAX_COLUMNS]
        rows = [[payload.get(c) for c in columns]]
        return columns, rows, False
    if isinstance(payload, list):
        if not payload:
            return [], [], False
        if isinstance(payload[0], dict):
            slice_items = payload[offset : offset + limit + 1]
            columns = sorted({k for item in slice_items for k in item})[:REST_API_MAX_COLUMNS]
            rows = [[item.get(c) for c in columns] for item in slice_items]
            truncated = len(rows) > limit
            return columns, rows[:limit], truncated
    return ["value"], [[json.dumps(payload)]], False


def _normalize_base_url(host: str, port: int) -> str:
    host = host.strip().rstrip("/")
    if host.startswith("http://") or host.startswith("https://"):
        return host
    scheme = "https" if port == 443 else "http"
    return f"{scheme}://{host}" if "://" not in host else host


def probe_readonly_fetch(client: httpx.Client, *, path: str) -> bool:
    try:
        resp = client.get(path, timeout=5.0)
        return resp.is_success
    except Exception:
        return False


class RestApiConnector:
    type = "rest_api"
    category = "api"
    capabilities = ("connectivity_test", "schema_browser", "native_query")
    display_name = "REST API"

    def _client(self, **kwargs: Any) -> httpx.Client:
        base = _normalize_base_url(kwargs["host"], int(kwargs.get("port", 443)))
        username = kwargs.get("username") or ""
        password = kwargs.get("password") or ""
        connection_options = kwargs.get("connection_options") or {}
        rest_auth_mode = connection_options.get("restAuthMode") or connection_options.get(
            "rest_auth_mode"
        )
        if rest_auth_mode == "bearer" or username == "bearer":
            headers = {"Authorization": f"Bearer {password}"} if password else None
            timeout = float(kwargs.get("timeout_sec", 5.0))
            return httpx.Client(
                base_url=base,
                headers=headers,
                timeout=timeout,
                follow_redirects=True,
            )
        auth = None
        if username and username not in ("none", "oauth2", "bearer"):
            auth = (username, password)
        timeout = float(kwargs.get("timeout_sec", 5.0))
        return httpx.Client(base_url=base, auth=auth, timeout=timeout, follow_redirects=True)

    def test_connection(self, **kwargs: Any) -> TestConnectionResult:
        started = time.perf_counter()
        try:
            base = _normalize_base_url(kwargs["host"], int(kwargs.get("port", 443)))
            if not urlparse(base).scheme:
                raise ValueError("invalid url: missing scheme")
            probe = kwargs.get("database") or "/"
            probe_path = _normalize_probe_path(probe)
            if _is_local_vitalspan_base(base) and _is_sample_api_path(probe_path):
                with self._client(**kwargs) as client:
                    _fetch_sample_api_payload(probe_path, client.auth)
                ok, code, detail = True, None, "Connection successful"
            else:
                with self._client(**kwargs) as client:
                    resp = client.get(probe_path)
                if resp.status_code == 401:
                    code, detail = REST_API_AUTH_FAILED, "Unauthorized"
                    ok = False
                elif not resp.is_success:
                    code, detail = REST_API_PROBE_FAILED, f"HTTP {resp.status_code}"
                    ok = False
                else:
                    ok, code, detail = True, None, "Connection successful"
        except Exception as exc:
            code, detail = map_rest_api_error(exc)
            if "missing scheme" in str(exc).lower():
                code = REST_API_INVALID_URL
            ok = False
        latency_ms = int((time.perf_counter() - started) * 1000)
        if ok:
            return TestConnectionResult(ok=True, message=detail, latency_ms=latency_ms, code=None)
        return TestConnectionResult(ok=False, message=f"[{code}] {detail}", latency_ms=latency_ms, code=code)

    def open_connection(self, **kwargs: Any) -> httpx.Client:
        return self._client(**kwargs)

    def list_schemas(self, connection: httpx.Client) -> list[SchemaInfo]:
        return [SchemaInfo(name="api")]

    def list_tables(self, connection: httpx.Client, schema: str) -> list[TableInfo]:
        return [TableInfo(name="endpoints", type="ENDPOINT")]

    def list_columns(self, connection: httpx.Client, schema: str, table: str) -> list[ColumnInfo]:
        return [
            ColumnInfo(name="path", data_type="string", nullable=False),
            ColumnInfo(name="method", data_type="string", nullable=True),
        ]

    def execute_native_query(
        self,
        connection: httpx.Client,
        *,
        body: dict,
        limit: int,
        offset: int = 0,
        database: str | None = None,
    ) -> tuple[list[str], list[list], bool]:
        guard_native_injection(body)
        path = body.get("path")
        if not isinstance(path, str) or not path.strip():
            raise QueryError("QUERY_NATIVE_INVALID_BODY", "body.path is required", 422)
        method = str(body.get("method", "GET")).upper()
        if method != "GET":
            raise QueryError(REST_API_PROBE_FAILED, f"Unsupported method {method}", 400)
        request_path = path if path.startswith("/") else f"/{path}"
        base = str(getattr(connection, "base_url", ""))
        if _is_local_vitalspan_base(base) and _is_sample_api_path(request_path):
            payload = _fetch_sample_api_payload(request_path, connection.auth)
        else:
            resp = connection.request(method, request_path)
            if resp.status_code == 401:
                raise QueryError(REST_API_AUTH_FAILED, "Unauthorized", 401)
            if not resp.is_success:
                raise QueryError(REST_API_PROBE_FAILED, f"HTTP {resp.status_code}", 400)
            payload = resp.json()
        json_path = body.get("jsonPath")
        if isinstance(json_path, str):
            return _payload_to_rows(payload, limit=limit, offset=offset, json_path=json_path)
        return _payload_to_rows(payload, limit=limit, offset=offset, json_path=None)
