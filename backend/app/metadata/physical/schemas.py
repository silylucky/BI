from __future__ import annotations

import uuid

from pydantic import BaseModel, ConfigDict, Field


class PhysicalColumn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    name: str = Field(min_length=1, max_length=64)
    data_type: str = Field(alias="dataType", min_length=1, max_length=32)
    nullable: bool = True
    description: str | None = Field(default=None, max_length=256)


class PhysicalTableRegisterFromSchemaIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    data_source_id: uuid.UUID = Field(alias="dataSourceId")
    schema_name: str = Field(alias="schema", min_length=1, max_length=128)
    table: str = Field(min_length=1, max_length=128)
    display_name: str = Field(min_length=1, max_length=120, alias="displayName")
    entity_type_code: str | None = Field(default=None, alias="entityTypeCode", max_length=64)
    table_fqn: str | None = Field(default=None, alias="tableFqn")


class PhysicalTableRegisterIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    table_fqn: str = Field(
        alias="tableFqn",
        pattern=r"^[a-z][a-z0-9_]{0,62}\.[a-z][a-z0-9_]{1,63}$",
    )
    data_source_id: uuid.UUID = Field(alias="dataSourceId")
    display_name: str = Field(min_length=1, max_length=120, alias="displayName")
    entity_type_code: str | None = Field(default=None, alias="entityTypeCode", max_length=64)
    columns: list[PhysicalColumn]


class PhysicalTableUpdateIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    display_name: str | None = Field(default=None, alias="displayName", min_length=1, max_length=120)
    entity_type_code: str | None = Field(default=None, alias="entityTypeCode", max_length=64)


class PhysicalTableOut(PhysicalTableRegisterIn):
    source_schema: str | None = Field(default=None, alias="sourceSchema", max_length=128)
    source_table: str | None = Field(default=None, alias="sourceTable", max_length=128)


class PhysicalTableValidateOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    valid: bool
    table_fqn: str = Field(alias="tableFqn")
    column_count: int = Field(alias="columnCount")


class PhysicalTableListResponse(BaseModel):
    items: list[PhysicalTableOut]
    total: int
