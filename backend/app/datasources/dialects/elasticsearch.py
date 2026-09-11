from __future__ import annotations

import time
from typing import Any

from elasticsearch import Elasticsearch

from app.core.config import get_settings
from app.datasources.dialects.base import ColumnInfo, SchemaInfo, TableInfo, TestConnectionResult
from app.datasources.type_normalize import normalize_search_type
from app.query.native.guard import guard_native_injection
from app.query.schemas import QueryError

ES_INVALID_HOST = "ES_INVALID_HOST"
ES_CONNECTION_REFUSED = "ES_CONNECTION_REFUSED"
ES_AUTH_FAILED = "ES_AUTH_FAILED"
ES_TIMEOUT = "ES_TIMEOUT"
ES_UNKNOWN = "ES_UNKNOWN"
ES_MAX_MAPPING_FIELDS = 500


def probe_readonly_search(connection: Any, *, index: str) -> bool:
    if not index.strip():
        return False
    try:
        connection.search(index=index, body={"query": {"match_all": {}}, "size": 1})
        return True
    except Exception:
        return False


def _build_client(*, host: str, port: int, username: str, password: str, timeout_sec: float) -> Elasticsearch:
    if not host.strip():
        raise ValueError("host is required")
    scheme = "https" if port == 443 else "http"
    url = f"{scheme}://{host}:{port}"
    kwargs: dict[str, Any] = {"hosts": [url], "request_timeout": timeout_sec}
    if username or password:
        kwargs["basic_auth"] = (username, password)
    return Elasticsearch(**kwargs)


class ElasticsearchConnector:
    type = "elasticsearch"
    category = "search"
    capabilities = ("connectivity_test", "schema_browser")
    display_name = "Elasticsearch"

    def test_connection(
        self,
        *,
        host: str,
        port: int,
        database: str,
        username: str,
        password: str,
        timeout_sec: float = 5.0,
        **_: object,
    ) -> TestConnectionResult:
        started = time.perf_counter()
        try:
            client = _build_client(
                host=host, port=port, username=username, password=password, timeout_sec=timeout_sec
            )
            client.info()
        except ValueError:
            return TestConnectionResult(
                ok=False,
                message="[ES_INVALID_HOST] host is required",
                latency_ms=int((time.perf_counter() - started) * 1000),
                code=ES_INVALID_HOST,
            )
        except Exception as exc:
            msg = str(exc).lower()
            code = ES_UNKNOWN
            if "timeout" in msg or "timed out" in msg:
                code = ES_TIMEOUT
            elif "connection refused" in msg or "failed to establish" in msg:
                code = ES_CONNECTION_REFUSED
            elif "authentication" in msg or "401" in msg or "403" in msg:
                code = ES_AUTH_FAILED
            latency_ms = int((time.perf_counter() - started) * 1000)
            return TestConnectionResult(ok=False, message=f"[{code}] {exc}", latency_ms=latency_ms, code=code)
        latency_ms = int((time.perf_counter() - started) * 1000)
        return TestConnectionResult(ok=True, message="Connection successful", latency_ms=latency_ms, code=None)

    def open_connection(
        self,
        *,
        host: str,
        port: int,
        database: str,
        username: str,
        password: str,
        connect_timeout_sec: float = 5.0,
        **_: object,
    ) -> Elasticsearch:
        return _build_client(
            host=host,
            port=port,
            username=username,
            password=password,
            timeout_sec=connect_timeout_sec,
        )

    def list_schemas(self, connection: Elasticsearch) -> list[SchemaInfo]:
        rows = connection.cat.indices(format="json")
        names = [row["index"] for row in rows if not str(row["index"]).startswith(".")]
        return [SchemaInfo(name=n) for n in sorted(names)]

    def list_tables(self, connection: Elasticsearch, schema: str) -> list[TableInfo]:
        return [TableInfo(name="_doc", type="index")]

    def list_columns(self, connection: Elasticsearch, schema: str, table: str) -> list[ColumnInfo]:
        mapping = connection.indices.get_mapping(index=schema)
        props = mapping.get(schema, {}).get("mappings", {}).get("properties", {})
        columns = [
            ColumnInfo(
                name=name,
                data_type=normalize_search_type(str(meta.get("type", "object"))),
                nullable=True,
            )
            for name, meta in sorted(props.items())
        ]
        if len(columns) > ES_MAX_MAPPING_FIELDS:
            return columns[:ES_MAX_MAPPING_FIELDS]
        return columns

    def execute_native_query(
        self,
        connection: Any,
        *,
        body: dict,
        index: str | None,
        limit: int,
    ) -> tuple[list[str], list[list], bool]:
        guard_native_injection(body)
        if not isinstance(body.get("query"), dict):
            raise QueryError("QUERY_NATIVE_INVALID_BODY", "body.query object is required", 422)
        resolved_index = index or body.get("index")
        if not isinstance(resolved_index, str) or not resolved_index.strip():
            raise QueryError("QUERY_NATIVE_INVALID_BODY", "index is required", 422)
        cap = min(limit, get_settings().query_default_limit)
        search_body = dict(body)
        search_body["size"] = cap + 1
        try:
            result = connection.search(index=resolved_index, body=search_body)
        except Exception as exc:
            raise QueryError("QUERY_EXECUTION_ERROR", str(exc), 400) from exc
        hits = result.get("hits", {}).get("hits", [])
        truncated = len(hits) > cap
        hits = hits[:cap]
        if not hits:
            return [], [], False
        source = hits[0].get("_source", {})
        columns = sorted(source.keys())
        rows = [[h.get("_source", {}).get(c) for c in columns] for h in hits]
        return columns, rows, truncated
