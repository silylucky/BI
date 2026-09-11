from __future__ import annotations

from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi

from app.core.config import get_settings
from app.openapi.version_policy import apply_version_policy

IF06_DATASOURCE_PREFIX = "/api/v1/datasources"
IF06_QUERY_EXECUTE = "/api/v1/query/execute"

_EXECUTE_REQUEST_EXAMPLES = {
    "sql": {
        "summary": "SQL query",
        "value": {
            "dataSourceId": "00000000-0000-4000-8000-000000000001",
            "mode": "sql",
            "sql": "SELECT 1 AS value",
        },
    },
    "table": {
        "summary": "Table query",
        "value": {
            "dataSourceId": "00000000-0000-4000-8000-000000000001",
            "mode": "table",
            "schema": "public",
            "table": "orders",
        },
    },
}

_DS_ID_EXAMPLE = "00000000-0000-4000-8000-000000000001"
_DS_OUT_EXAMPLE = {
    "id": _DS_ID_EXAMPLE,
    "name": "Orders Warehouse",
    "code": "orders-wh",
    "type": "postgresql",
    "host": "db.internal",
    "port": 5432,
    "database": "analytics",
    "createdAt": "2026-07-04T00:00:00Z",
}

_EXECUTE_200_EXAMPLE = {
    "columns": ["value"],
    "rows": [[1]],
    "rowCount": 1,
    "truncated": False,
    "traceId": "abc123trace",
}

_BUS_REGISTER_EXAMPLE = {
    "id": "00000000-0000-4000-8000-00000000b001",
    "status": "succeeded",
    "traceId": "trace-bus-r45",
    "busResponse": {"busId": "bus-r45-demo"},
}

_SERVICES_LIST_EXAMPLE = {
    "items": [{
        "id": "00000000-0000-4000-8000-00000000s001",
        "name": "Demo Service",
        "httpMethod": "POST",
        "path": "/api/v1/demo",
        "categoryCodes": ["CAT-01"],
        "status": "published",
        "version": "v1",
        "createdAt": "2026-07-04T00:00:00Z",
    }],
    "total": 1,
    "limit": 50,
    "offset": 0,
}

_EXPORT_READY_EXAMPLE = {
    "exportId": "00000000-0000-4000-8000-00000000e001",
    "templateId": "00000000-0000-4000-8000-0000000000a1",
    "format": "pdf",
    "status": "ready",
    "downloadUrl": "/api/v1/reports/export/00000000-0000-4000-8000-00000000e001/download",
    "expiresAt": "2026-07-04T01:00:00Z",
    "requestedAt": "2026-07-04T00:00:00Z",
    "traceId": "trace-export-r45",
}

_EMBED_TOKEN_EXAMPLE = {
    "token": "embed-token-r45-demo",
    "expiresAt": "2026-07-04T01:00:00Z",
    "embedUrl": "/embed/embed-token-r45-demo",
    "sdkParams": {
        "containerId": "embed-demo",
        "theme": "light",
        "apiBase": "/api/v1",
        "token": "embed-token-r45-demo",
    },
}


def _inject_datasource_openapi(schema: dict) -> None:
    paths = schema.get("paths", {})
    coll = paths.get("/api/v1/datasources", {})
    if "post" in coll:
        resp = coll["post"].setdefault("responses", {}).setdefault("201", {})
        content = resp.setdefault("content", {}).setdefault("application/json", {})
        content["example"] = _DS_OUT_EXAMPLE
    if "get" in coll:
        resp = coll["get"].setdefault("responses", {}).setdefault("200", {})
        content = resp.setdefault("content", {}).setdefault("application/json", {})
        content["example"] = {"items": [_DS_OUT_EXAMPLE], "total": 1}
    detail = paths.get("/api/v1/datasources/{data_source_id}", {})
    for verb in detail.values():
        for param in verb.get("parameters", []):
            if param.get("name") == "data_source_id":
                param["example"] = _DS_ID_EXAMPLE
        if verb.get("responses", {}).get("200"):
            content = verb["responses"]["200"].setdefault("content", {}).setdefault(
                "application/json", {}
            )
            content["example"] = _DS_OUT_EXAMPLE


def _inject_execute_openapi(schema: dict) -> None:
    op = schema.get("paths", {}).get("/api/v1/query/execute", {}).get("post")
    if not op:
        return
    resp_200 = op.setdefault("responses", {}).setdefault("200", {"description": "OK"})
    content_200 = resp_200.setdefault("content", {}).setdefault("application/json", {})
    content_200["example"] = _EXECUTE_200_EXAMPLE
    for code, err_code in (("400", "QUERY_NOT_READONLY"), ("403", "RESOURCE_FORBIDDEN")):
        resp = op.setdefault("responses", {}).setdefault(code, {"description": err_code})
        content = resp.setdefault("content", {}).setdefault("application/json", {})
        content["example"] = {"code": err_code, "message": err_code, "detail": None}


def _inject_if06_tags(schema: dict) -> None:
    for prefix in ("/api/v1/gov", "/api/v1/views"):
        for path, methods in schema.get("paths", {}).items():
            if not path.startswith(prefix):
                continue
            for op in methods.values():
                tags = list(op.get("tags") or [])
                if "IF-06" not in tags:
                    tags.append("IF-06")
                op["tags"] = tags


def _inject_integration_openapi_examples(schema: dict) -> None:
    paths = schema.get("paths", {})
    bus_post = paths.get("/api/v1/integration/bus/register", {}).get("post")
    if bus_post:
        resp = bus_post.setdefault("responses", {}).setdefault("201", {})
        content = resp.setdefault("content", {}).setdefault("application/json", {})
        content["example"] = _BUS_REGISTER_EXAMPLE
    services_get = paths.get("/api/v1/services", {}).get("get")
    if services_get:
        resp = services_get.setdefault("responses", {}).setdefault("200", {})
        content = resp.setdefault("content", {}).setdefault("application/json", {})
        content["example"] = _SERVICES_LIST_EXAMPLE
    export_get = paths.get("/api/v1/reports/export", {}).get("get")
    if export_get:
        resp = export_get.setdefault("responses", {}).setdefault("200", {})
        content = resp.setdefault("content", {}).setdefault("application/json", {})
        content["example"] = _EXPORT_READY_EXAMPLE
    embed_post = paths.get("/api/v1/embed/token", {}).get("post")
    if embed_post:
        resp = embed_post.setdefault("responses", {}).setdefault("201", {})
        content = resp.setdefault("content", {}).setdefault("application/json", {})
        content["example"] = _EMBED_TOKEN_EXAMPLE


def customize_openapi(app: FastAPI) -> dict:
    if app.openapi_schema:
        return app.openapi_schema
    settings = get_settings()
    schema = get_openapi(
        title=app.title,
        version=settings.api_openapi_version,
        description=(
            "VitalSpan REST API. All business routes are under /api/v1/. "
            "Breaking changes bump major OpenAPI version."
        ),
        routes=app.routes,
    )
    for path, methods in schema.get("paths", {}).items():
        for verb, op in methods.items():
            if path.startswith(IF06_DATASOURCE_PREFIX):
                tags = list(op.get("tags") or [])
                if "IF-06" not in tags:
                    tags.append("IF-06")
                op["tags"] = tags
                op_id = op.get("operationId") or ""
                if not op_id.startswith("if06."):
                    op["operationId"] = f"if06.datasources.{op_id or verb}"
            if path == IF06_QUERY_EXECUTE and verb == "post":
                tags = list(op.get("tags") or [])
                if "IF-06" not in tags:
                    tags.append("IF-06")
                op["tags"] = tags
                op["operationId"] = "if06.query.execute"
                request_body = op.setdefault("requestBody", {})
                content = request_body.setdefault("content", {})
                json_content = content.setdefault("application/json", {})
                json_content.setdefault("examples", _EXECUTE_REQUEST_EXAMPLES)
    _inject_datasource_openapi(schema)
    _inject_execute_openapi(schema)
    _inject_integration_openapi_examples(schema)
    _inject_if06_tags(schema)
    apply_version_policy(schema)
    schema["info"]["version"] = settings.api_openapi_version
    app.openapi_schema = schema
    return schema
