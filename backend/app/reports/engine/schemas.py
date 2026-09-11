from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class ExportHookOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    integration_path: str = Field(alias="integrationPath")
    format: str
    placeholder: bool = True


class RenderRunIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    parameters: dict[str, Any] = Field(default_factory=dict)
    format: Literal["web", "html", "pdf", "excel"] = "web"
    data_source_id: uuid.UUID | None = Field(default=None, alias="dataSourceId")


class EngineRenderSpec(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    template_node_id: uuid.UUID = Field(alias="templateNodeId")
    engine_version: str = Field(default="1.0", alias="engineVersion")
    format: str
    sections: list[dict[str, Any]]
    parameters: dict[str, Any]
    rendered_at: datetime = Field(alias="renderedAt")
    meta: dict[str, Any] | None = None


class EngineSection(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    kind: Literal["table", "chart"]
    chart_type: str | None = Field(default=None, alias="chartType")
    columns: list[str] = Field(default_factory=list)
    rows: list[list[Any]] = Field(default_factory=list)
    metric_key: str | None = Field(default=None, alias="metricKey")
    placeholder: bool = False


class QueryMeta(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    section_count: int = Field(alias="sectionCount")
    elapsed_ms: float = Field(alias="elapsedMs")


class RenderRunOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    status: Literal["ready", "empty"] = "ready"
    render_spec: EngineRenderSpec = Field(alias="renderSpec")
    query_meta: QueryMeta | None = Field(default=None, alias="queryMeta")
    export_hook: ExportHookOut | None = Field(default=None, alias="exportHook")
