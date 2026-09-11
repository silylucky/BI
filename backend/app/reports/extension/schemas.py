from __future__ import annotations

import uuid

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

_KEY_PATTERN = r"^[a-z][a-z0-9_]{0,63}$"


class MetricAdjustment(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)
    key: str = Field(pattern=_KEY_PATTERN)
    label: str = Field(min_length=1, max_length=120)
    expression: str | None = None
    visible: bool = True
    compare_mode: str = Field(default="none", alias="compareMode")
    query_mode: Literal["dataset", "sql"] = Field(default="dataset", alias="queryMode")
    dataset_id: str | None = Field(default=None, alias="datasetId")
    bound_config_id: uuid.UUID | None = Field(default=None, alias="boundConfigId")
    dimension_dict_code: str | None = Field(default=None, alias="dimensionDictCode", max_length=64)
    dimension_value_column: str | None = Field(default=None, alias="dimensionValueColumn", max_length=128)

    @model_validator(mode="after")
    def validate_query_mode(self) -> MetricAdjustment:
        if self.dataset_id or self.bound_config_id:
            if not self.dataset_id or not self.bound_config_id:
                raise ValueError("dataset mode requires datasetId and boundConfigId")
        return self


class FilterAdjustment(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)
    key: str = Field(pattern=_KEY_PATTERN)
    operator: str
    default_value: str | None = Field(default=None, alias="defaultValue")
    required: bool = False


class ExtensionConfigUpsert(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)
    catalog_node_id: uuid.UUID = Field(alias="catalogNodeId")
    metrics: list[MetricAdjustment] = Field(default_factory=list)
    filters: list[FilterAdjustment] = Field(default_factory=list)
    change_note: str | None = Field(default=None, max_length=500, alias="changeNote")
    default_data_source_id: uuid.UUID | None = Field(default=None, alias="defaultDataSourceId")


class ExtensionConfigOut(ExtensionConfigUpsert):
    revision: int


class ExtensionRenderSpecOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)
    template_node_id: str = Field(alias="templateNodeId")
    revision: int
    template_kind: str | None = Field(default=None, alias="templateKind")
    metrics: list[dict]
    filters: list[dict]
    render_version: str = Field(alias="renderVersion")


class ExtensionRevisionOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)
    revision: int
    change_note: str | None = Field(default=None, alias="changeNote")
    updated_at: str = Field(alias="updatedAt")


class ExtensionRevisionListOut(BaseModel):
    items: list[ExtensionRevisionOut]


class TemplateReadinessIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    node_ids: list[uuid.UUID] = Field(default_factory=list, alias="nodeIds")


class ExtensionPersistenceSnapshotOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    store: str
    revision: int
    metrics: list[dict]
    filters: list[dict]
    audit_entry_count: int = Field(alias="auditEntryCount")
