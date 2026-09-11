import logging
import uuid

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from app.core.logging import trace_id_var

logger = logging.getLogger("vitalspan.http")


class TraceIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        incoming = request.headers.get("X-Trace-Id")
        trace_id = incoming or uuid.uuid4().hex
        token = trace_id_var.set(trace_id)
        logger.info(
            "request_started",
            extra={"method": request.method, "path": request.url.path},
        )
        try:
            response = await call_next(request)
            response.headers["X-Trace-Id"] = trace_id
            logger.info(
                "request_finished",
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": response.status_code,
                },
            )
        finally:
            trace_id_var.reset(token)
        return response
