from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CatalogCategoryOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)
    code: str
    name: str
    description: str | None = None
    kind: str


class CatalogEntryCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    name: str = Field(min_length=1, max_length=120)
    http_method: str = Field(alias="httpMethod", min_length=1, max_length=8)
    path: str = Field(min_length=1, max_length=255)
    category_codes: list[str] = Field(alias="categoryCodes", min_length=1)
    openapi_operation_id: str | None = Field(default=None, alias="openapiOperationId")
    status: str = Field(default="draft", min_length=1, max_length=16)


class CatalogEntryOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)
    id: uuid.UUID
    name: str
    http_method: str = Field(alias="httpMethod")
    path: str
    category_codes: list[str] = Field(alias="categoryCodes")
    openapi_operation_id: str | None = Field(default=None, alias="openapiOperationId")
    status: str
    created_at: datetime = Field(alias="createdAt")


class CatalogListResponse(BaseModel):
    items: list[CatalogEntryOut]
    total: int
    limit: int
    offset: int


class CategoryListResponse(BaseModel):
    items: list[CatalogCategoryOut]


class AppendixETaxonomyOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    appendix: str = "E"
    version: int = 1
    taxonomy: list[dict[str, str]]
    schema_: dict[str, object] = Field(alias="schema")


class BusRegisterIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    catalog_entry_id: uuid.UUID = Field(alias="catalogEntryId")


class BusRegisterOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: uuid.UUID
    status: str
    trace_id: str = Field(alias="traceId")
    bus_response: dict | None = Field(default=None, alias="busResponse")


class SemiAutoFsmOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    fsm_state: str = Field(alias="fsmState")
    catalog_entry_id: uuid.UUID = Field(alias="catalogEntryId")
    bus_id: str | None = Field(default=None, alias="busId")
