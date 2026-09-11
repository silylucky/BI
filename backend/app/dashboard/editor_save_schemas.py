from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from app.dashboard.global_filters.schemas import GlobalFilterLinkageItem, GlobalFilterLinkageOut
from app.dashboard.schemas import DashboardLayout, DashboardOut


class DashboardEditorSaveIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    name: str | None = Field(default=None, min_length=1, max_length=120)
    layout_json: DashboardLayout = Field(alias="layoutJson")
    global_filters: GlobalFilterLinkageItem | None = Field(default=None, alias="globalFilters")


class DashboardEditorSaveOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)
    dashboard: DashboardOut
    global_filters: GlobalFilterLinkageOut | None = Field(default=None, alias="globalFilters")
