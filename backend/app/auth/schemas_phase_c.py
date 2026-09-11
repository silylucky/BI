from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

OverrideEffect = Literal["add", "deny"]
MaskStrategy = Literal["hide", "partial", "hash"]


class UserResourceGrantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True, serialize_by_alias=True)

    id: uuid.UUID
    user_id: uuid.UUID = Field(alias="userId")
    resource_type: str = Field(alias="resourceType")
    resource_id: uuid.UUID = Field(alias="resourceId")
    effect: OverrideEffect


class UserResourceGrantListResponse(BaseModel):
    items: list[UserResourceGrantOut]


class UserResourceGrantUpsert(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    resource_type: str = Field(alias="resourceType")
    resource_id: uuid.UUID = Field(alias="resourceId")
    effect: OverrideEffect


class UserDimensionOverrideOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True, serialize_by_alias=True)

    user_id: uuid.UUID = Field(alias="userId")
    dimension_type_id: uuid.UUID = Field(alias="dimensionTypeId")
    value: str
    effect: OverrideEffect


class UserDimensionOverrideListResponse(BaseModel):
    items: list[UserDimensionOverrideOut]


class UserDimensionOverrideUpsert(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    dimension_type_id: uuid.UUID = Field(alias="dimensionTypeId")
    value: str
    effect: OverrideEffect


class ColumnMaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True, serialize_by_alias=True)

    id: uuid.UUID
    datasource_id: uuid.UUID | None = Field(default=None, alias="datasourceId")
    dataset_id: str | None = Field(default=None, alias="datasetId")
    table_name: str = Field(alias="tableName")
    column_name: str = Field(alias="columnName")
    mask_strategy: MaskStrategy = Field(alias="maskStrategy")


class ColumnMaskListResponse(BaseModel):
    items: list[ColumnMaskOut]


class ColumnMaskCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    datasource_id: uuid.UUID | None = Field(default=None, alias="datasourceId")
    dataset_id: str | None = Field(default=None, alias="datasetId")
    table_name: str = Field(alias="tableName")
    column_name: str = Field(alias="columnName")
    mask_strategy: MaskStrategy = Field(alias="maskStrategy")


class AuthIntegrationStatusOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    ldap_enabled: bool = Field(alias="ldapEnabled", default=False)
    oidc_enabled: bool = Field(alias="oidcEnabled", default=False)
    spec_ready: bool = Field(alias="specReady", default=True)
