from __future__ import annotations


class IntegrationError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        status: int = 400,
        fields: list[dict[str, str]] | None = None,
        trace_id: str | None = None,
    ) -> None:
        self.code = code
        self.message = message
        self.status = status
        self.fields = fields or []
        self.trace_id = trace_id
        super().__init__(message)
