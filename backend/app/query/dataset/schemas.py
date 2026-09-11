from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.query.schemas import RlsOptions

CHART_FILTER_OPS = frozenset({"eq", "neq", "gt", "gte", "lt", "lte", "in"})
CHART_METRIC_AGGS = frozenset({"sum", "avg", "max", "min", "count"})


class ChartMetricEncoding(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    field: str = Field(min_length=1)
    agg: Literal["sum", "avg", "max", "min", "count"] = "sum"


class ChartFilterEncoding(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    field: str = Field(min_length=1)
    operator: Literal["eq", "neq", "gt", "gte", "lt", "lte", "in"] = "eq"
    value: object | None = None


class ChartTimeRangeEncoding(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    enabled: bool = False
    field: str | None = None
    start: str | None = None
    end: str | None = None


class ChartExecuteEncoding(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    chart_type: str = Field(alias="chartType", min_length=1)
    dimensions: list[str] = Field(default_factory=list)
    metrics: list[ChartMetricEncoding] = Field(default_factory=list)
    filters: list[ChartFilterEncoding] = Field(default_factory=list)
    time_range: ChartTimeRangeEncoding | None = Field(default=None, alias="timeRange")

    @field_validator("dimensions")
    @classmethod
    def strip_dimensions(cls, dims: list[str]) -> list[str]:
        return [d.strip() for d in dims if d and d.strip()]


class DatasetQuerySpec(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="allow")
    dataset_id: str = Field(alias="datasetId", min_length=1, max_length=64)
    parameters: dict[str, object] = Field(default_factory=dict)
    operation: str = "select"


class DatasetValidateOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    dataset_id: str = Field(alias="datasetId")
    resolved_path: Literal["dataset"] = Field(default="dataset", alias="resolvedPath")
    readonly: bool = True


class DatasetRoutingOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    paths: list[str]
    boundary_notes: dict[str, str] = Field(alias="boundaryNotes")


class ExecutePlanStep(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    step: Literal["path_resolve", "acl_check", "readonly_guard", "plan_ready"]
    status: Literal["pass", "skip", "fail"]
    detail: str | None = None


class DatasetExecutePlanOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    dataset_id: str = Field(alias="datasetId")
    resolved_path: Literal["dataset"] = Field(default="dataset", alias="resolvedPath")
    readonly: bool = True
    steps: list[ExecutePlanStep]
    plan_version: str = Field(default="dataset-plan-v1", alias="planVersion")


class DatasetExecuteRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    data_source_id: uuid.UUID = Field(alias="dataSourceId")
    config_id: uuid.UUID = Field(alias="configId")
    parameters: dict[str, object] = Field(default_factory=dict)
    limit: int | None = Field(default=None, ge=1)
    offset: int = Field(default=0, ge=0)
    rls: RlsOptions = Field(default_factory=RlsOptions)
    encoding: ChartExecuteEncoding | None = None


class DatasetExecuteResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    config_id: uuid.UUID = Field(alias="configId")
    config_revision: int = Field(alias="configRevision")
    columns: list[str]
    rows: list[list[object]]
    row_count: int = Field(alias="rowCount")
    truncated: bool
    trace_id: str = Field(alias="traceId")
