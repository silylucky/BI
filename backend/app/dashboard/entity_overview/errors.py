from __future__ import annotations

DASH_OVERVIEW_INVALID_ENTITY_TYPE = "DASH_OVERVIEW_INVALID_ENTITY_TYPE"
DASH_OVERVIEW_INVALID_DRILL_WIDGET = "DASH_OVERVIEW_INVALID_DRILL_WIDGET"
DASH_OVERVIEW_INVALID_METRIC_SOURCE = "DASH_OVERVIEW_INVALID_METRIC_SOURCE"
DASH_OVERVIEW_METRIC_KEY_MISMATCH = "DASH_OVERVIEW_METRIC_KEY_MISMATCH"


class EntityOverviewError(Exception):
    def __init__(self, code: str, message: str, status: int = 400, fields: list | None = None) -> None:
        self.code = code
        self.message = message
        self.status = status
        self.fields = fields
        super().__init__(message)
