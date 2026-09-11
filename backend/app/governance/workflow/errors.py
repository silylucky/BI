from __future__ import annotations


GOV_WORKFLOW_CONFLICT = "GOV_WORKFLOW_CONFLICT"
GOV_WORKFLOW_ALREADY_TERMINAL = "GOV_WORKFLOW_ALREADY_TERMINAL"


class WorkflowError(Exception):
    def __init__(self, code: str, message: str, status: int, detail: dict | None = None) -> None:
        self.code = code
        self.message = message
        self.status = status
        self.detail = detail
        super().__init__(message)
