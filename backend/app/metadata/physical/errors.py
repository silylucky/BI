from __future__ import annotations

META_PHYSICAL_FORBIDDEN = "META_PHYSICAL_FORBIDDEN"
META_PHYSICAL_INVALID_COLUMN = "META_PHYSICAL_INVALID_COLUMN"
META_PHYSICAL_DS_TABLE_CONFLICT = "META_PHYSICAL_DS_TABLE_CONFLICT"
META_PHYSICAL_GOV_IN_USE = "META_PHYSICAL_GOV_IN_USE"


class PhysicalTableError(Exception):
    def __init__(self, code: str, message: str, status: int = 422, fields: list | None = None) -> None:
        self.code = code
        self.message = message
        self.status = status
        self.fields = fields or []
        super().__init__(message)
