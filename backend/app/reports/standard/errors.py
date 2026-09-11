from __future__ import annotations

RPT_STD_NOT_FOUND = "RPT_STD_NOT_FOUND"
RPT_STD_FORBIDDEN = "RPT_STD_FORBIDDEN"
RPT_STD_THEME_DISABLED = "RPT_STD_THEME_DISABLED"
RPT_STD_THEME_UNSUPPORTED = "RPT_STD_THEME_UNSUPPORTED"
RPT_STD_TABLE_NOT_FOUND = "RPT_STD_TABLE_NOT_FOUND"
RPT_STD_DATASET_NOT_FOUND = "RPT_STD_DATASET_NOT_FOUND"
RPT_STD_DATASET_UNBOUND = "RPT_STD_DATASET_UNBOUND"
RPT_STD_FIELD_MAPPING = "RPT_STD_FIELD_MAPPING"
RPT_STD_SNAPSHOT_NOT_FOUND = "RPT_STD_SNAPSHOT_NOT_FOUND"
RPT_STD_KEY_MISMATCH = "RPT_STD_KEY_MISMATCH"
RPT_STD_EMPTY_ROLES = "RPT_STD_EMPTY_ROLES"


class StandardAnalysisError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        status: int = 400,
        detail: list | dict | None = None,
    ) -> None:
        self.code = code
        self.message = message
        self.status = status
        self.detail = detail or {}
        super().__init__(message)
