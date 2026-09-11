from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

_VALID_GRANULARITY = frozenset({"day", "week", "month", "yoy", "mom"})


class ThemeDimensionBinding(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    dimension_id: str = Field(alias="dimensionId", min_length=1, max_length=64)
    label: str | None = None
    sort_order: int = Field(default=0, alias="sortOrder")


class GeoBinding(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    lat_field: str = Field(alias="latField", min_length=1)
    lng_field: str = Field(alias="lngField", min_length=1)
    admin_code_field: str | None = Field(default=None, alias="adminCodeField")


class ThemeChartViewBinding(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    widget_id: str = Field(alias="widgetId", min_length=1, max_length=64)
    dimension_id: str | None = Field(default=None, alias="dimensionId")


class EntityThemeConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    schema_version: str = Field(default="1.0", alias="schemaVersion")
    entity_type: str = Field(alias="entityType", min_length=1, max_length=64)
    time_granularity: str = Field(alias="timeGranularity")
    dimensions: list[ThemeDimensionBinding] = Field(min_length=1)
    geo_binding: GeoBinding | None = Field(default=None, alias="geoBinding")
    ref_type: str = Field(default="dashboard", alias="refType")
    ref_id: uuid.UUID = Field(alias="refId")
    chart_view_bindings: list[ThemeChartViewBinding] = Field(
        default_factory=list, alias="chartViewBindings", max_length=16
    )

    @field_validator("time_granularity")
    @classmethod
    def _granularity(cls, value: str) -> str:
        if value not in _VALID_GRANULARITY:
            raise ValueError("invalid granularity")
        return value


class ThemePlanStep(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    step: Literal["config_load", "bindings_resolve", "granularity_window", "geo_check"]
    status: Literal["pass", "skip", "fail"]
    detail: str | None = None


class CompareWindowInterval(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    start: str
    end: str


class CompareWindow(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    current: CompareWindowInterval
    baseline: CompareWindowInterval


class ThemeExecutePlanOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    plan_version: str = Field(default="theme-plan-v1", alias="planVersion")
    ref_type: str = Field(alias="refType")
    ref_id: uuid.UUID = Field(alias="refId")
    steps: list[ThemePlanStep]
    compare_window: CompareWindow | None = Field(default=None, alias="compareWindow")
    resolved_widgets: list[dict] = Field(default_factory=list, alias="resolvedWidgets")
