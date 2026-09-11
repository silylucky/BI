from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class OpenApiMappingCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    catalog_entry_id: uuid.UUID | None = Field(default=None, alias="catalogEntryId")
    http_method: Literal["GET", "POST"] = Field(alias="httpMethod")
    path: str
    operation_id: str = Field(min_length=1, max_length=128, alias="operationId")
    entity_type_ref: str | None = Field(default=None, alias="entityTypeRef")
    api_version: str = Field(default="v1", alias="apiVersion")


class OpenApiMappingValidateOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    valid: bool
    api_version: Literal["v1"] = Field(alias="apiVersion")
    warnings: list[str] = Field(default_factory=list)


class OpenApiMappingOut(OpenApiMappingCreate):
    id: uuid.UUID
    active: bool


class OpenApiMappingListOut(BaseModel):
    items: list[OpenApiMappingOut]
