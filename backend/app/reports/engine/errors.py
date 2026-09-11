from __future__ import annotations

RPT_ENGINE_FORBIDDEN = "RPT_ENGINE_FORBIDDEN"
RPT_ENGINE_INVALID_PARAMETER = "RPT_ENGINE_INVALID_PARAMETER"
RPT_ENGINE_DATASOURCE_REQUIRED = "RPT_ENGINE_DATASOURCE_REQUIRED"
RPT_ENGINE_QUERY_FAILED = "RPT_ENGINE_QUERY_FAILED"
RPT_ENGINE_EMPTY_TEMPLATE = "RPT_ENGINE_EMPTY_TEMPLATE"


class ReportEngineError(Exception):
    def __init__(self, code: str, message: str, status: int = 422, fields: list | None = None) -> None:
        self.code = code
        self.message = message
        self.status = status
        self.fields = fields or []
        super().__init__(message)
