from __future__ import annotations

import uuid

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.dashboard.schemas import DashboardLayout

# Error codes: VIEW_INVALID_LAYOUT, VIEW_LAYOUT_BOUNDS, VIEW_UNKNOWN_CHART_REF,
# VIEW_CHART_REF_CYCLE, VIEW_DEFAULT_SELF_REF


class ViewError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        status: int = 422,
        fields: list[dict[str, str]] | None = None,
    ) -> None:
        self.code = code
        self.message = message
        self.status = status
        self.fields = fields or []
        super().__init__(message)


class DashboardView(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=120)
    protocol_version: Literal[1] = Field(default=1, alias="protocolVersion")
    dashboard_id: uuid.UUID | None = Field(default=None, alias="dashboardId")
    default_view_id: uuid.UUID | None = Field(default=None, alias="defaultViewId")
    layout: DashboardLayout
