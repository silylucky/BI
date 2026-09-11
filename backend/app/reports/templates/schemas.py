from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

TemplateFormat = Literal["excel", "pdf"]
BlockType = Literal["sql", "table", "chart", "crosstab"]
ChartType = Literal["line", "bar", "pie"]
CrosstabAgg = Literal["sum", "count", "max", "min"]
_STORAGE_REF_RE = r"^storage://templates/[a-z0-9_-]+\.(excel|pdf)$"


class TemplateBlock(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    block_type: str = Field(alias="blockType")
    query_ref: str | None = Field(default=None, alias="queryRef", max_length=256)
    table_ref: str | None = Field(default=None, alias="tableRef", max_length=256)
    chart_type: ChartType | None = Field(default=None, alias="chartType")
    row_field: str | None = Field(default=None, alias="rowField", max_length=64)
    col_field: str | None = Field(default=None, alias="colField", max_length=64)
    value_field: str | None = Field(default=None, alias="valueField", max_length=64)
    agg: CrosstabAgg | None = Field(default="sum")


class ExportHookOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    integration_path: str = Field(alias="integrationPath")
    format: TemplateFormat
    placeholder: bool = True


class TemplateDefinitionIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    template_key: str = Field(alias="templateKey", pattern=r"^[a-z][a-z0-9_-]{1,63}$")
    format: TemplateFormat
    display_name: str = Field(min_length=1, max_length=120, alias="displayName")
    blocks: list[TemplateBlock]
    storage_ref: str | None = Field(default=None, alias="storageRef", pattern=_STORAGE_REF_RE)


class TemplateDefinitionOut(TemplateDefinitionIn):
    export_hook: ExportHookOut = Field(alias="exportHook")


class TemplateListOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    items: list[TemplateDefinitionOut]


class TemplateValidateOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    valid: bool
    template_key: str = Field(alias="templateKey")
    block_count: int = Field(alias="blockCount")

