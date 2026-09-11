from __future__ import annotations

CAT06_EMPTY_METRICS = "CAT06_EMPTY_METRICS"


class Cat06Error(Exception):
    def __init__(self, code: str, message: str, status: int = 422, fields: list | None = None) -> None:
        self.code = code
        self.message = message
        self.status = status
        self.fields = fields or []
        super().__init__(message)
