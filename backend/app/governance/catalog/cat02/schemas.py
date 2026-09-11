from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class AggregateTemplateIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    aggregate_key: str = Field(alias="aggregateKey", pattern=r"^[A-Z][A-Z0-9_]{1,31}$")
    display_name: str = Field(min_length=1, max_length=120, alias="displayName")
    dimensions: list[str] = Field(default_factory=list)
    metrics: list[str] = Field(default_factory=list)
    aggregation_fn: str = Field(default="sum", alias="aggregationFn")
    attribution_label: str = Field(min_length=1, max_length=128, alias="attributionLabel")
    table_ref: str | None = Field(default=None, alias="tableRef")


class AggregateTemplateOut(AggregateTemplateIn):
    pass


class AggregateTemplateValidateOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    valid: bool
    aggregate_key: str = Field(alias="aggregateKey")


class AggregateTemplateListResponse(BaseModel):
    items: list[AggregateTemplateOut]
    total: int


class AggregateAttributionOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    aggregate_key: str = Field(alias="aggregateKey")
    attribution_label: str = Field(alias="attributionLabel")
    dimensions: list[str]
    metrics: list[str]
    aggregation_fn: str = Field(alias="aggregationFn")
    poc_ready: bool = Field(alias="pocReady")


class AggregateQueryOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    template_key: str = Field(alias="templateKey")
    group_by: str = Field(alias="groupBy")
    dimensions: list[str]
    metrics: list[str]
    rows: list[dict[str, object]]
    poc_ready: bool = Field(alias="pocReady")
