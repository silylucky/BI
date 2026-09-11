from __future__ import annotations

VIZ_SDK_TOKEN_REQUIRED = "VIZ_SDK_TOKEN_REQUIRED"
VIZ_SDK_DUPLICATE_ORIGIN = "VIZ_SDK_DUPLICATE_ORIGIN"
VIZ_SDK_FORBIDDEN = "VIZ_SDK_FORBIDDEN"


class SdkPortalError(Exception):
    def __init__(self, code: str, message: str, status: int = 422, fields: list | None = None) -> None:
        self.code = code
        self.message = message
        self.status = status
        self.fields = fields or []
        super().__init__(message)
