from __future__ import annotations

CAT02_EMPTY_DIMENSIONS = "CAT02_EMPTY_DIMENSIONS"
CAT02_EMPTY_METRICS = "CAT02_EMPTY_METRICS"
CAT02_INVALID_AGGREGATION = "CAT02_INVALID_AGGREGATION"
CAT02_KEY_CONFLICT = "CAT02_KEY_CONFLICT"
CAT02_NOT_FOUND = "CAT02_NOT_FOUND"
CAT02_FORBIDDEN = "CAT02_FORBIDDEN"
CAT02_DUPLICATE_DIMENSION = "CAT02_DUPLICATE_DIMENSION"
CAT02_DUPLICATE_METRIC = "CAT02_DUPLICATE_METRIC"


class Cat02Error(Exception):
    def __init__(self, code: str, message: str, status: int = 422, fields: list | None = None) -> None:
        self.code = code
        self.message = message
        self.status = status
        self.fields = fields or []
        super().__init__(message)
