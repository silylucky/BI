from __future__ import annotations


class ReportExtensionError(Exception):
    def __init__(self, code: str, message: str, status: int = 400, fields: dict | None = None) -> None:
        self.code = code
        self.message = message
        self.status = status
        self.fields = fields
        super().__init__(message)


class ReportBatchError(Exception):
    def __init__(self, code: str, message: str, status: int = 400, fields: dict | None = None) -> None:
        self.code = code
        self.message = message
        self.status = status
        self.fields = fields
        super().__init__(message)
