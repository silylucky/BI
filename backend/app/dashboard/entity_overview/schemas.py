from __future__ import annotations

import uuid

from pydantic import BaseModel, ConfigDict, Field


class MetricSourceDef(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    widget_id: str = Field(alias="widgetId", min_length=1, max_length=64)


class StatCardDef(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    metric_key: str = Field(alias="metricKey", min_length=1, max_length=64)
    label: str = Field(min_length=1, max_length=120)
    metric_source: MetricSourceDef | None = Field(default=None, alias="metricSource")


class FilterDef(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    dimension_id: str = Field(alias="dimensionId", min_length=1, max_length=64)
    default_value: str | None = Field(default=None, alias="defaultValue")


class DrillTargetDef(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    widget_id: str = Field(alias="widgetId", min_length=1, max_length=64)
    target_dashboard_id: uuid.UUID | None = Field(default=None, alias="targetDashboardId")


class EntityOverviewItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    dashboard_id: uuid.UUID = Field(alias="dashboardId")
    entity_type_ref: str = Field(alias="entityTypeRef", min_length=1, max_length=64)
    stat_cards: list[StatCardDef] = Field(alias="statCards")
    filters: list[FilterDef] = Field(default_factory=list)
    drill_targets: list[DrillTargetDef] = Field(default_factory=list, alias="drillTargets")
    catalog_entry_id: uuid.UUID | None = Field(default=None, alias="catalogEntryId")


class EntityOverviewOut(EntityOverviewItem):
    publish_status: str | None = Field(default=None, alias="publishStatus")
