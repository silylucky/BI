from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.designer.schemas import ComputeRulesConfig, QueryConditionsConfig

GOV_REF_TYPE = "gov_query_design"
GOV_CONFIG_TYPE = "visual_query_design"


class GovQueryDesignError(Exception):
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


class VisualQueryDesignIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    schema_version: str = Field(alias="schemaVersion", default="1.0")
    ref_type: str = Field(alias="refType", default=GOV_REF_TYPE)
    ref_id: uuid.UUID = Field(alias="refId")
    title: str = Field(min_length=1)
    status: Literal["draft", "pending_publish"] = "draft"
    data_source_id: uuid.UUID | None = Field(default=None, alias="dataSourceId")
    conditions: QueryConditionsConfig
    compute_rules: ComputeRulesConfig | None = Field(default=None, alias="computeRules")
    expected_revision: int | None = Field(default=None, alias="expectedRevision")


class VisualQueryDesignOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    schema_version: str = Field(alias="schemaVersion")
    ref_type: str = Field(alias="refType")
    ref_id: uuid.UUID = Field(alias="refId")
    title: str
    status: str
    data_source_id: uuid.UUID | None = Field(alias="dataSourceId")
    conditions: dict
    compute_rules: dict | None = Field(alias="computeRules")
    revision: int


class PreviewExecuteIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    data_source_id: uuid.UUID | None = Field(default=None, alias="dataSourceId")


class PreviewExecuteOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    rls_fragment: str = Field(alias="rlsFragment")
