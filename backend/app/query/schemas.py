from __future__ import annotations

import uuid
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.core.config import get_settings


class QueryError(Exception):
    def __init__(self, code: str, message: str, status: int = 400) -> None:
        self.code = code
        self.message = message
        self.status = status
        super().__init__(message)


class RlsOptions(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    enabled: bool = True
    table_alias: str = Field(default="t", alias="tableAlias")
    org_column: str = Field(default="org_node_id", alias="orgColumn")
    region_column: str | None = Field(default=None, alias="regionColumn")


class ExecuteRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    data_source_id: uuid.UUID | None = Field(default=None, alias="dataSourceId")
    mode: Literal["sql", "table", "native"] | None = None
    sql: str | None = None
    schema: str | None = None
    table: str | None = None
    native_body: dict[str, Any] | None = Field(default=None, alias="nativeBody")
    index: str | None = None
    limit: int | None = Field(default=None, ge=1)
    offset: int = Field(default=0, ge=0)
    binding_id: uuid.UUID | None = Field(default=None, alias="bindingId")
    rls: RlsOptions = Field(default_factory=RlsOptions)

    @model_validator(mode="after")
    def validate_limit_cap(self) -> ExecuteRequest:
        cap = get_settings().query_default_limit
        if self.limit is not None and self.limit > cap:
            raise ValueError(f"limit must be <= {cap}")
        return self

    @model_validator(mode="after")
    def validate_mode_fields(self) -> ExecuteRequest:
        if self.binding_id is not None:
            inline = [self.mode, self.sql, self.schema, self.table, self.data_source_id]
            if any(v is not None for v in inline):
                raise ValueError("bindingId is mutually exclusive with inline execute fields")
            return self
        if self.mode == "sql":
            if self.data_source_id is None or not self.sql:
                raise ValueError("sql mode requires dataSourceId and sql")
        elif self.mode == "table":
            if self.data_source_id is None or not self.schema or not self.table:
                raise ValueError("table mode requires dataSourceId, schema and table")
        elif self.mode == "native":
            if self.data_source_id is None or not self.native_body:
                raise ValueError("native mode requires dataSourceId and nativeBody")
        else:
            raise ValueError("mode is required when bindingId is absent")
        return self


class ExecuteResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    columns: list[str]
    rows: list[list[Any]]
    row_count: int = Field(alias="rowCount")
    truncated: bool
    trace_id: str = Field(alias="traceId")


class BindingCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    name: str = Field(min_length=1, max_length=128)
    data_source_id: uuid.UUID = Field(alias="dataSourceId")
    mode: Literal["sql", "table"]
    sql: str | None = None
    schema_name: str | None = Field(default=None, alias="schema")
    table_name: str | None = Field(default=None, alias="table")
    default_limit: int = Field(default=100, alias="defaultLimit", ge=1)
    chart_id: uuid.UUID | None = Field(default=None, alias="chartId")


class BindingUpdate(BindingCreate):
    pass


class BindingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
    id: uuid.UUID
    name: str
    data_source_id: uuid.UUID = Field(alias="dataSourceId")
    mode: str
    sql: str | None = None
    schema_name: str | None = Field(default=None, alias="schema")
    table_name: str | None = Field(default=None, alias="table")
    default_limit: int = Field(alias="defaultLimit")
    chart_id: uuid.UUID | None = Field(default=None, alias="chartId")


class BindingListResponse(BaseModel):
    items: list[BindingOut]
    total: int
