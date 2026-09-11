from __future__ import annotations

import uuid
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.query.translator.schemas import TranslateConditions


ALLOWED_CONFIG_TYPES = frozenset({
    "query_conditions",
    "compute_rules",
    "visual_query_design",
    "sql_mode",
    "output_fields",
    "workflow_instance",
    "entity_theme",
    "entity_overview",
    "designer_workflow_link",
    "workflow_template",
    "designer_snapshot",
    "design_mode",
    "publish_version_history",
    "global_filter_linkage",
    "dataset_query",
    "gov_lifecycle_template",
    "gov_aggregate_template",
    "gov_ticket_stats",
    "gov_production_stats",
})
ALLOWED_SCHEMA_VERSIONS = frozenset({"1.0"})
DEFAULT_REF_TYPE = "design_draft"
MAX_CONFIG_PAYLOAD_BYTES = 262_144


class ConfigError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        status: int = 400,
        fields: list[dict[str, str]] | None = None,
    ) -> None:
        self.code = code
        self.message = message
        self.status = status
        self.fields = fields or []
        super().__init__(message)


class ConfigUpsert(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    config_type: str = Field(alias="configType")
    schema_version: str = Field(alias="schemaVersion", default="1.0")
    ref_type: str | None = Field(default=DEFAULT_REF_TYPE, alias="refType")
    ref_id: uuid.UUID | None = Field(default=None, alias="refId")
    payload: Any
    expected_revision: int | None = Field(default=None, alias="expectedRevision")


class ConfigOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
    id: uuid.UUID
    config_type: str = Field(alias="configType")
    schema_version: str = Field(alias="schemaVersion")
    ref_type: str | None = Field(alias="refType")
    ref_id: uuid.UUID | None = Field(alias="refId")
    owner_id: uuid.UUID | None = Field(alias="ownerId")
    payload: dict
    revision: int


class ConfigListResponse(BaseModel):
    items: list[ConfigOut]
    total: int


class DatasetQueryConfigPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    data_source_id: uuid.UUID = Field(alias="dataSourceId")
    connector_type: str = Field(alias="connectorType")
    schema_name: str = Field(alias="schema")
    table: str
    columns: list[str] = Field(min_length=1)
    column_kinds: dict[str, str] | None = Field(default=None, alias="columnKinds")
    conditions: TranslateConditions | None = None
    limit: int | None = Field(default=None, ge=1)
    offset: int = Field(default=0, ge=0)

    @field_validator("columns")
    @classmethod
    def reject_star(cls, cols: list[str]) -> list[str]:
        if any(c.strip() == "*" for c in cols):
            raise ValueError("wildcard * is not allowed")
        return cols

    @model_validator(mode="after")
    def validate_column_kinds(self) -> DatasetQueryConfigPayload:
        if not self.column_kinds:
            return self
        allowed = {"dimension", "metric"}
        for key, kind in self.column_kinds.items():
            if key not in self.columns:
                raise ValueError(f"columnKinds key {key!r} must be in columns")
            if kind not in allowed:
                raise ValueError(f"columnKinds[{key!r}] must be dimension or metric")
        return self
