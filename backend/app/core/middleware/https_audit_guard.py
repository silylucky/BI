from __future__ import annotations

import json

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from app.core.config import get_settings
from app.core.logging import trace_id_var
from app.core.nfr.https_audit import record_audit_event


class HttpsAuditGuardMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)
        if get_settings().vitalspan_env != "production":
            return response
        path = request.url.path
        if not path.startswith("/api/v1/"):
            return response
        content_type = response.headers.get("content-type", "")
        if "application/json" not in content_type:
            return response

        body_bytes = b""
        if getattr(response, "body", None):
            body_bytes = response.body
        else:
            chunks: list[bytes] = []
            async for chunk in response.body_iterator:
                chunks.append(chunk)
            body_bytes = b"".join(chunks)
            response = Response(
                content=body_bytes,
                status_code=response.status_code,
                headers=dict(response.headers),
                media_type=response.media_type,
            )

        if not body_bytes:
            return response

        try:
            payload = json.loads(body_bytes)
        except (json.JSONDecodeError, TypeError):
            return response
        if not isinstance(payload, dict):
            return response

        trace_id = trace_id_var.get() or ""
        masked = record_audit_event(
            trace_id=trace_id,
            path=path,
            method=request.method,
            body=payload,
        )
        if masked:
            response.headers["X-Audit-Sampled"] = "1"
        return response
