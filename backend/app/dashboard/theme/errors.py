from __future__ import annotations

DASH_THEME_DIMENSION_UNKNOWN = "DASH_THEME_DIMENSION_UNKNOWN"


class ThemeAnalysisError(Exception):
    def __init__(self, code: str, message: str, status: int = 400, fields: list | None = None) -> None:
        self.code = code
        self.message = message
        self.status = status
        self.fields = fields or []
        super().__init__(message)
