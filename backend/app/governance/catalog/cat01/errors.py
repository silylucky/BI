from __future__ import annotations

CAT01_EMPTY_STAGES = "CAT01_EMPTY_STAGES"
CAT01_DUPLICATE_STAGE = "CAT01_DUPLICATE_STAGE"
CAT01_INVALID_ENTITY_TYPE = "CAT01_INVALID_ENTITY_TYPE"
CAT01_KEY_CONFLICT = "CAT01_KEY_CONFLICT"
CAT01_NOT_FOUND = "CAT01_NOT_FOUND"
CAT01_FORBIDDEN = "CAT01_FORBIDDEN"
CAT01_EMPTY_ROLES = "CAT01_EMPTY_ROLES"
CAT01_STAGE_NOT_FOUND = "CAT01_STAGE_NOT_FOUND"
CAT01_STAGE_INDEX_OUT_OF_BOUNDS = "CAT01_STAGE_INDEX_OUT_OF_BOUNDS"


class Cat01Error(Exception):
    def __init__(self, code: str, message: str, status: int = 422, fields: list | None = None) -> None:
        self.code = code
        self.message = message
        self.status = status
        self.fields = fields or []
        super().__init__(message)
