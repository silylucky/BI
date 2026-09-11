from __future__ import annotations


RPT_TEMPLATE_FORBIDDEN = "RPT_TEMPLATE_FORBIDDEN"
RPT_TEMPLATE_DUPLICATE_BLOCK = "RPT_TEMPLATE_DUPLICATE_BLOCK"
RPT_TEMPLATE_IN_USE = "RPT_TEMPLATE_IN_USE"


class TemplateDefError(Exception):
    def __init__(self, code: str, message: str, status: int = 422, fields: list | None = None) -> None:
        self.code = code
        self.message = message
        self.status = status
        self.fields = fields or []
        super().__init__(message)
