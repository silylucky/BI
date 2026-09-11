from __future__ import annotations


CAT_CLASS_NOT_FOUND = "CAT_CLASS_NOT_FOUND"
CAT_CLASS_FORBIDDEN = "CAT_CLASS_FORBIDDEN"


class ClassificationError(Exception):
    def __init__(self, code: str, message: str, status: int = 400, fields: list | None = None) -> None:
        self.code = code
        self.message = message
        self.status = status
        self.fields = fields
        super().__init__(message)
