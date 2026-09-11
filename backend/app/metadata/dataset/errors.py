from __future__ import annotations

META_DATASET_FORBIDDEN = "META_DATASET_FORBIDDEN"
META_DATASET_DUPLICATE_TABLE = "META_DATASET_DUPLICATE_TABLE"
META_DATASET_DEMO_PROTECTED = "META_DATASET_DEMO_PROTECTED"


class DatasetError(Exception):
    def __init__(self, code: str, message: str, status: int = 400, fields: list | None = None) -> None:
        self.code = code
        self.message = message
        self.status = status
        self.fields = fields
        super().__init__(message)
