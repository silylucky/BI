from __future__ import annotations


DASH_FILTER_INVALID_DIMENSION_REF = "DASH_FILTER_INVALID_DIMENSION_REF"
DASH_FILTER_DUPLICATE_PARAMETER_KEY = "DASH_FILTER_DUPLICATE_PARAMETER_KEY"


class GlobalFilterError(Exception):
    def __init__(self, code: str, message: str, status: int = 422, fields: list | None = None) -> None:
        self.code = code
        self.message = message
        self.status = status
        self.fields = fields or []
        super().__init__(message)
