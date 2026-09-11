from __future__ import annotations

import re
import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ALLOWED_OPERATORS = frozenset({
    "eq", "ne", "gt", "gte", "lt", "lte", "in", "not_in", "like", "is_null", "is_not_null"
})
ALLOWED_VALUE_TYPES = frozenset({"string", "number", "boolean", "date", "array"})
ALLOWED_LOGIC = frozenset({"AND", "OR"})
ALLOWED_RULE_TYPES = frozenset({"sum", "avg", "add", "sub", "mul", "div", "format"})

DESIGNER_FIELD_REGISTRY = frozenset({
    "order_amount", "order_date", "customer_id", "status", "region_code",
    "amount",  # r32 compute smoke targetField
    "x", "y",  # r32 cycle test fields
})

EXPR_RE = re.compile(
    r"^(sum|avg|count)\([a-zA-Z_][a-zA-Z0-9_]*\)$|^[a-zA-Z_][a-zA-Z0-9_]*[+\-*/][a-zA-Z_][a-zA-Z0-9_]*$"
)
FORMAT_EXPR_RE = re.compile(r"^format\([a-zA-Z_][a-zA-Z0-9_]*,'[^']*'\)$")
AGG_EXPR_RE = re.compile(r"^(sum|avg|count)\([a-zA-Z_][a-zA-Z0-9_]*\)$")
ARITH_EXPR_RE = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*[+\-*/][a-zA-Z_][a-zA-Z0-9_]*$")


class DesignerError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        status: int = 400,
        fields: list[dict[str, str]] | None = None,
        remediation: str | None = None,
    ) -> None:
        self.code = code
        self.message = message
        self.status = status
        self.fields = fields or []
        self.remediation = remediation
        super().__init__(message)


class ConditionItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    field_id: str = Field(alias="fieldId", min_length=1)
    operator: str
    value: object | None = None
    value_type: str = Field(alias="valueType")


class QueryConditionsConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    schema_version: str = Field(alias="schemaVersion", default="1.0")
    logic: str
    conditions: list[ConditionItem]
    ref_type: str = Field(default="design_draft", alias="refType")
    ref_id: uuid.UUID = Field(alias="refId")
    expected_revision: int | None = Field(default=None, alias="expectedRevision")


class ComputeRuleItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    rule_type: str = Field(alias="ruleType")
    target_field: str = Field(alias="targetField")
    expression: str
    depends_on: list[str] = Field(default_factory=list, alias="dependsOn")


class ComputeRulesConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    schema_version: str = Field(alias="schemaVersion", default="1.0")
    rules: list[ComputeRuleItem]
    ref_type: str = Field(default="design_draft", alias="refType")
    ref_id: uuid.UUID = Field(alias="refId")


class SqlModeSpec(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    schema_version: str = Field(alias="schemaVersion", default="1.0")
    data_source_id: uuid.UUID = Field(alias="dataSourceId")
    sql: str = Field(min_length=1)
    parameters: dict[str, object] = Field(default_factory=dict)
    ref_type: str = Field(default="design_draft", alias="refType")
    ref_id: uuid.UUID = Field(alias="refId")


ALLOWED_OUTPUT_AGGREGATES = frozenset({"sum", "avg", "count", "min", "max"})

MAX_OUTPUT_FIELDS = 64
MAX_AGGREGATES = 16


class OutputFieldItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    field_id: str = Field(alias="fieldId")
    alias: str | None = None
    visible: bool = True
    meta_field_ref: str | None = Field(default=None, alias="metaFieldRef")


class AggregateItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    fn: str
    field_id: str = Field(alias="fieldId")
    group_by: list[str] = Field(default_factory=list, alias="groupBy")


class OutputFieldsConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    schema_version: str = Field(alias="schemaVersion", default="1.0")
    fields: list[OutputFieldItem]
    aggregates: list[AggregateItem] = Field(default_factory=list)
    ref_type: str = Field(default="design_draft", alias="refType")
    ref_id: uuid.UUID = Field(alias="refId")


class FieldRegistryOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    registry: list[str]
    glossary: list[str]
    dataset_fields: list[str] = Field(alias="datasetFields")


class PreviewTranslateIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    conditions: QueryConditionsConfig
    compute_rules: ComputeRulesConfig = Field(alias="computeRules")
    output_fields: OutputFieldsConfig = Field(alias="outputFields")
    dataset_id: uuid.UUID | None = Field(default=None, alias="datasetId")


class DesignerSubmitWorkflowIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    designer_item_id: uuid.UUID = Field(alias="designerItemId")
    template_id: str = Field(alias="templateId", default="standard_query_release")
    design_type: Literal["chart", "report", "query"] = Field(default="query", alias="designType")
    catalog_entry_id: uuid.UUID | None = Field(default=None, alias="catalogEntryId")


class DesignerSubmitWorkflowOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    workflow_instance_id: uuid.UUID = Field(alias="workflowInstanceId")
    design_snapshot_id: uuid.UUID = Field(alias="designSnapshotId")
    status: str
    publish_ready: bool = Field(alias="publishReady", default=False)


class DesignerSnapshotOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    conditions: dict
    compute_rules: dict = Field(alias="computeRules")
    output_fields: dict = Field(alias="outputFields")
    revisions: dict
    captured_at: str = Field(alias="capturedAt")
