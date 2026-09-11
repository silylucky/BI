from __future__ import annotations

import re
import uuid

from pydantic import BaseModel, ConfigDict, Field, field_validator

META_DIM_FORBIDDEN = "META_DIM_FORBIDDEN"

DIM_CODE_RE = re.compile(r"^[a-z][a-z0-9_]{1,63}$")
DIM_STATUS_VALUES = frozenset({"active", "inactive"})


class DimensionError(Exception):
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


class DimensionCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    code: str
    name: str = Field(min_length=1, max_length=120)
    description: str | None = None
    status: str | None = None
    theme_node_id: uuid.UUID | None = Field(default=None, alias="themeNodeId")

    @field_validator("code")
    @classmethod
    def validate_code(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("code must not be blank")
        if not DIM_CODE_RE.match(v):
            raise ValueError("code must match ^[a-z][a-z0-9_]{1,63}$")
        return v


class DimensionUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    name: str = Field(min_length=1, max_length=120)
    description: str | None = None
    status: str | None = None
    theme_node_id: uuid.UUID | None = Field(default=None, alias="themeNodeId")


class DimensionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
    id: uuid.UUID
    code: str
    name: str
    description: str | None
    status: str
    theme_node_id: uuid.UUID | None = Field(default=None, alias="themeNodeId")


class DimensionListResponse(BaseModel):
    items: list[DimensionOut]
    total: int


class DimensionResolveOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
    id: uuid.UUID
    code: str
    name: str
    status: str


class DimensionValueItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    code: str
    label: str
    sort_order: int = Field(default=0, alias="sortOrder")

    @field_validator("code", "label")
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        return v.strip()


class DimensionValuesRegister(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    items: list[DimensionValueItem] = Field(min_length=1)


class DimensionValueOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
    id: uuid.UUID
    code: str
    label: str
    sort_order: int = Field(alias="sortOrder")
    status: str


class DimensionValueListResponse(BaseModel):
    items: list[DimensionValueOut]
    total: int
