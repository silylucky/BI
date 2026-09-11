from __future__ import annotations

import re
import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.datasources.dialects.base import TestConnectionResult

DATASOURCE_CODE_RE = re.compile(r"^[a-z][a-z0-9_-]{1,63}$")


class ConnectionOptions(BaseModel):
    charset: str = "utf8mb4"
    collation: str | None = None
    ssl_mode: Literal["disabled", "preferred", "required"] = Field(
        default="preferred", alias="sslMode"
    )
    connect_timeout_sec: float = Field(default=5.0, ge=1.0, le=30.0, alias="connectTimeoutSec")
    read_timeout_sec: float | None = Field(default=None, alias="readTimeoutSec")
    pool_size: int = Field(default=4, ge=1, le=10, alias="poolSize")
    rest_auth_mode: Literal["none", "basic", "bearer", "oauth2"] | None = Field(
        default=None, alias="restAuthMode"
    )

    model_config = {"populate_by_name": True}


class DataSourceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    code: str
    type: str = Field(min_length=1, max_length=32)
    host: str = Field(min_length=1, max_length=255)
    port: int = Field(ge=1, le=65535)
    database: str = Field(min_length=1, max_length=128)
    username: str = Field(min_length=1, max_length=128)
    password: str = Field(min_length=1)
    description: str | None = None
    connection_options: ConnectionOptions | None = Field(default=None, alias="connectionOptions")

    model_config = {"populate_by_name": True}

    @field_validator("code")
    @classmethod
    def validate_code(cls, value: str) -> str:
        if not DATASOURCE_CODE_RE.match(value):
            raise ValueError("code must match ^[a-z][a-z0-9_-]{1,63}$")
        return value


class DataSourceUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    host: str = Field(min_length=1, max_length=255)
    port: int = Field(ge=1, le=65535)
    database: str = Field(min_length=1, max_length=128)
    username: str = Field(min_length=1, max_length=128)
    password: str = ""
    description: str | None = None
    connection_options: ConnectionOptions | None = Field(default=None, alias="connectionOptions")

    model_config = {"populate_by_name": True}


class DataSourcePatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    host: str | None = None
    port: int | None = Field(default=None, ge=1, le=65535)
    database: str | None = None
    username: str | None = None
    password: str | None = None
    description: str | None = None
    connection_options: ConnectionOptions | None = Field(default=None, alias="connectionOptions")

    model_config = {"populate_by_name": True}


class DataSourceOut(BaseModel):
    id: uuid.UUID
    name: str
    code: str
    type: str
    host: str
    port: int
    database: str
    username: str
    password: str = "***"
    description: str | None
    connection_options: ConnectionOptions | None = Field(default=None, alias="connectionOptions")
    is_demo_package: bool = Field(default=False, alias="isDemoPackage")

    model_config = {"populate_by_name": True}


class DataSourceListResponse(BaseModel):
    items: list[DataSourceOut]
    total: int
    limit: int
    offset: int


class TestConnectionIn(DataSourceCreate):
    pass


class TestConnectionOut(BaseModel):
    ok: bool
    message: str
    latency_ms: int | None = Field(serialization_alias="latencyMs")
    trace_id: str | None = Field(default=None, serialization_alias="traceId")
    code: str | None = None

    model_config = {"populate_by_name": True}

    @classmethod
    def from_result(cls, result: TestConnectionResult, *, trace_id: str | None = None) -> TestConnectionOut:
        return cls(
            ok=result.ok,
            message=result.message,
            latency_ms=result.latency_ms,
            trace_id=trace_id,
            code=result.code,
        )


class ConnectorTypeOut(BaseModel):
    type: str
    display_name: str = Field(validation_alias="displayName", serialization_alias="displayName")
    category: str
    capabilities: list[str]
    display_group: str = Field(validation_alias="displayGroup", serialization_alias="displayGroup")
    category_label: str = Field(validation_alias="categoryLabel", serialization_alias="categoryLabel")
    query_capable: bool = Field(validation_alias="queryCapable", serialization_alias="queryCapable")
    query_mode: str | None = Field(default=None, validation_alias="queryMode", serialization_alias="queryMode")

    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)


class ConnectorTypeListResponse(BaseModel):
    items: list[ConnectorTypeOut]


class SchemaItemOut(BaseModel):
    name: str


class SchemaListResponse(BaseModel):
    items: list[SchemaItemOut]


class TableItemOut(BaseModel):
    name: str
    type: str


class TableListResponse(BaseModel):
    items: list[TableItemOut]


class ColumnItemOut(BaseModel):
    name: str
    data_type: str = Field(serialization_alias="dataType")
    nullable: bool

    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)


class ColumnListResponse(BaseModel):
    items: list[ColumnItemOut]
