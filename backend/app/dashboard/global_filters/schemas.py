from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.dashboard.schemas import FilterControlType, FilterOption

RefreshMode = Literal["eager", "lazy"]


class FilterBinding(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    filter_id: str = Field(alias="filterId", min_length=1, max_length=64)
    dimension_ref: str = Field(alias="dimensionRef", min_length=1, max_length=128)
    default_value: str | None = Field(default=None, alias="defaultValue")
    control_type: FilterControlType = Field(default="text", alias="controlType")
    options: list[FilterOption] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def default_control_text(cls, data: object) -> object:
        """Legacy bindings without controlType → text input."""
        if isinstance(data, dict) and data.get("controlType") is None and data.get("control_type") is None:
            data = {**data, "controlType": "text"}
        return data


class LinkageRule(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    source_filter_id: str = Field(alias="sourceFilterId")
    target_widget_ids: list[str] = Field(alias="targetWidgetIds", min_length=1)
    parameter_key: str = Field(alias="parameterKey", min_length=1, max_length=64)


class GlobalFilterLinkageItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    dashboard_id: uuid.UUID = Field(alias="dashboardId")
    filters: list[FilterBinding] = Field(default_factory=list)
    linkage_rules: list[LinkageRule] = Field(default_factory=list, alias="linkageRules")
    refresh_mode: RefreshMode = Field(default="eager", alias="refreshMode")


class GlobalFilterLinkageOut(GlobalFilterLinkageItem):
    affected_widget_count: int = Field(alias="affectedWidgetCount")
