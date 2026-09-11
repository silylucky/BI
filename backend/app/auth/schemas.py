from __future__ import annotations

import re
import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

ROLE_CODE_RE = re.compile(r"^[a-z][a-z0-9_]{1,63}$")
ResourceType = Literal["datasource", "dashboard", "report", "gov_catalog_entry"]
ValueType = Literal["string", "number", "boolean", "org_ref"]


class RoleCreate(BaseModel):
    code: str
    name: str = Field(min_length=1, max_length=128)
    description: str | None = None

    @field_validator("code")
    @classmethod
    def validate_code(cls, value: str) -> str:
        if not ROLE_CODE_RE.match(value):
            raise ValueError("code must match ^[a-z][a-z0-9_]{1,63}$")
        return value


class RoleUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    description: str | None = None
    is_active: bool | None = None


class RoleOut(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True, serialize_by_alias=True, from_attributes=True
    )

    id: uuid.UUID
    code: str
    name: str
    description: str | None
    is_active: bool = Field(alias="isActive")
    is_root: bool = Field(alias="isRoot")
    is_system: bool = Field(alias="isSystem")
    permission_version: int = Field(alias="permissionVersion")


class RoleListResponse(BaseModel):
    items: list[RoleOut]
    total: int


class PermissionOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True, from_attributes=True)

    id: uuid.UUID
    code: str
    name: str
    domain: str
    description: str | None = None


class PermissionListOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    items: list[PermissionOut]


class RolePermissionsReplace(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    permission_codes: list[str] = Field(alias="permissionCodes")
    expected_version: int = Field(alias="expectedVersion", ge=0)


class RolePermissionsOut(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True, serialize_by_alias=True, from_attributes=True
    )

    role_id: uuid.UUID = Field(alias="roleId")
    permission_codes: list[str] = Field(alias="permissionCodes")
    version: int
    all_permissions: bool = Field(alias="allPermissions")


class OrgCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    parent_id: uuid.UUID | None = None


class OrgUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    parent_id: uuid.UUID | None = None


class OrgOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    parent_id: uuid.UUID | None
    name: str
    path: str
    level: int


class OrgListResponse(BaseModel):
    items: list[OrgOut]
    total: int
    limit: int
    offset: int


class UserCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    username: str = Field(min_length=1, max_length=128)
    display_name: str | None = Field(default=None, alias="displayName", max_length=128)
    email: str | None = Field(default=None, max_length=255)
    org_id: uuid.UUID | None = Field(default=None, alias="orgId")
    role_ids: list[uuid.UUID] = Field(default_factory=list, alias="roleIds")
    initial_password: str = Field(alias="initialPassword", min_length=1, max_length=128)


class UserUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    display_name: str | None = Field(default=None, alias="displayName", max_length=128)
    email: str | None = Field(default=None, max_length=255)
    org_id: uuid.UUID | None = Field(default=None, alias="orgId")
    role_ids: list[uuid.UUID] | None = Field(default=None, alias="roleIds")


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, serialize_by_alias=True, populate_by_name=True)

    id: uuid.UUID
    username: str
    display_name: str | None = Field(default=None, serialization_alias="displayName")
    email: str | None = None
    is_active: bool = Field(default=True, serialization_alias="isActive")
    failed_login_count: int = Field(default=0, serialization_alias="failedLoginCount")
    locked_until: datetime | None = Field(default=None, serialization_alias="lockedUntil")
    org_node_id: uuid.UUID | None = Field(default=None, serialization_alias="orgId")


class UserListItemOut(UserOut):
    roles: list["UserRoleOut"] = Field(default_factory=list)


class ResetPasswordOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    temporary_password: str = Field(serialization_alias="temporaryPassword")
    password_changed_at: datetime = Field(serialization_alias="passwordChangedAt")


class UserListResponse(BaseModel):
    items: list[UserListItemOut]
    total: int


class UserRolesReplace(BaseModel):
    role_ids: list[uuid.UUID]


class UserRoleOut(BaseModel):
    id: uuid.UUID
    code: str
    name: str


class UserRolesResponse(BaseModel):
    items: list[UserRoleOut]


class UserOrgAssign(BaseModel):
    org_node_id: uuid.UUID


class UserOrgResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    parent_id: uuid.UUID | None
    name: str
    path: str
    level: int


class ResourceGrantCreate(BaseModel):
    role_id: uuid.UUID
    resource_type: ResourceType
    resource_id: uuid.UUID


class ResourceGrantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    role_id: uuid.UUID
    resource_type: str
    resource_id: uuid.UUID


class ResourceGrantListResponse(BaseModel):
    items: list[ResourceGrantOut]


class DimensionTypeCreate(BaseModel):
    code: str
    name: str = Field(min_length=1, max_length=128)
    value_type: ValueType
    description: str | None = None

    @field_validator("code")
    @classmethod
    def validate_code(cls, value: str) -> str:
        if not ROLE_CODE_RE.match(value):
            raise ValueError("code must match ^[a-z][a-z0-9_]{1,63}$")
        return value


class DimensionTypeUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    description: str | None = None


class DimensionTypeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: str
    name: str
    value_type: str
    org_dimension: bool
    description: str | None


class DimensionTypeListResponse(BaseModel):
    items: list[DimensionTypeOut]
    total: int


class AuditEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    actor_id: str
    actor_username: str | None
    target_type: str
    target_id: uuid.UUID
    action: str
    detail: str | None
    trace_id: str
    created_at: datetime


class AuditListResponse(BaseModel):
    items: list[AuditEventOut]
    total: int


class DimensionGroupCreate(BaseModel):
    dimension_type_id: uuid.UUID
    code: str
    name: str = Field(min_length=1, max_length=128)
    parent_id: uuid.UUID | None = None

    @field_validator("code")
    @classmethod
    def validate_code(cls, value: str) -> str:
        if not ROLE_CODE_RE.match(value):
            raise ValueError("code must match ^[a-z][a-z0-9_]{1,63}$")
        return value


class DimensionGroupUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    parent_id: uuid.UUID | None = None


class DimensionGroupOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    dimension_type_id: uuid.UUID
    code: str
    name: str
    parent_id: uuid.UUID | None


class DimensionGroupListResponse(BaseModel):
    items: list[DimensionGroupOut]
    total: int


class DimensionGroupValuesReplace(BaseModel):
    values: list[str] = Field(min_length=1)


class DimensionGroupValuesResponse(BaseModel):
    items: list[str]


class RoleDimensionGroupsOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    role_id: uuid.UUID = Field(alias="roleId")
    group_ids: list[uuid.UUID] = Field(alias="groupIds")
    version: int


class RoleDimensionValuesOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    role_id: uuid.UUID = Field(alias="roleId")
    dimension_type_id: uuid.UUID = Field(alias="dimensionTypeId")
    values: list[str]
    version: int


class RoleDimensionValuesReplace(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    dimension_type_id: uuid.UUID = Field(alias="dimensionTypeId")
    values: list[str]
    expected_version: int = Field(alias="expectedVersion", ge=0)
    confirm_empty: bool = Field(alias="confirmEmpty", default=False)


class RoleDimensionGroupsReplace(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    group_ids: list[uuid.UUID] = Field(alias="groupIds")
    expected_version: int = Field(alias="expectedVersion", ge=0)
    confirm_empty: bool = Field(alias="confirmEmpty", default=False)


class EffectiveDimensionsResponse(BaseModel):
    dimension_type_id: uuid.UUID
    values: list[str]


class RlsColumnBindingCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    datasource_id: uuid.UUID | None = Field(default=None, alias="datasourceId")
    dataset_id: str | None = Field(default=None, alias="datasetId")
    table_name: str = Field(alias="tableName", min_length=1, max_length=128)
    dimension_type_id: uuid.UUID = Field(alias="dimensionTypeId")
    column_name: str = Field(alias="columnName", min_length=1, max_length=64)


class RlsColumnBindingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True, serialize_by_alias=True)

    id: uuid.UUID
    datasource_id: uuid.UUID | None = Field(alias="datasourceId")
    dataset_id: str | None = Field(alias="datasetId")
    table_name: str = Field(alias="tableName")
    dimension_type_id: uuid.UUID = Field(alias="dimensionTypeId")
    column_name: str = Field(alias="columnName")
    created_at: datetime = Field(alias="createdAt")


class RlsColumnBindingListResponse(BaseModel):
    items: list[RlsColumnBindingOut]
    total: int


class RlsPreviewRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    datasource_id: uuid.UUID | None = Field(default=None, alias="datasourceId")
    dataset_id: str | None = Field(default=None, alias="datasetId")
    table_name: str = Field(alias="tableName", min_length=1, max_length=128)
    table_alias: str = Field(default="t", alias="tableAlias")
    org_column: str = Field(default="org_node_id", alias="orgColumn")


class RlsPreviewResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    fragment: str
    table_alias: str = Field(alias="tableAlias")
