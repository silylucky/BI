from __future__ import annotations

import re
import uuid

from pydantic import BaseModel, ConfigDict, Field, field_validator

META_TERM_FORBIDDEN = "META_TERM_FORBIDDEN"

TERM_CODE_RE = re.compile(r"^[a-z][a-z0-9_]{1,63}$")
TERM_MAX_TEXT_LENGTH = 4000
TERM_STATUS_VALUES = frozenset({"active", "inactive"})


class GlossaryError(Exception):
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


class TermCreate(BaseModel):
    code: str
    name: str = Field(min_length=1, max_length=120)
    definition: str | None = Field(default=None, max_length=TERM_MAX_TEXT_LENGTH)
    description: str | None = Field(default=None, max_length=TERM_MAX_TEXT_LENGTH)
    status: str | None = None

    @field_validator("code")
    @classmethod
    def validate_code(cls, v: str) -> str:
        if not TERM_CODE_RE.match(v):
            raise ValueError("code must match ^[a-z][a-z0-9_]{1,63}$")
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str | None) -> str | None:
        if v is not None and v not in TERM_STATUS_VALUES:
            raise ValueError(f"status must be one of {sorted(TERM_STATUS_VALUES)}")
        return v


class TermUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    definition: str | None = Field(default=None, max_length=TERM_MAX_TEXT_LENGTH)
    description: str | None = Field(default=None, max_length=TERM_MAX_TEXT_LENGTH)
    status: str | None = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str | None) -> str | None:
        if v is not None and v not in TERM_STATUS_VALUES:
            raise ValueError(f"status must be one of {sorted(TERM_STATUS_VALUES)}")
        return v


class TermOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    code: str
    name: str
    definition: str | None
    description: str | None
    status: str


class TermListResponse(BaseModel):
    items: list[TermOut]
    total: int


class TermFieldMappingItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    table_fqn: str = Field(alias="tableFqn", min_length=3, max_length=128)
    column_name: str = Field(alias="columnName", min_length=1, max_length=64)


class TermFieldMappingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
    id: uuid.UUID
    table_fqn: str = Field(alias="tableFqn")
    column_name: str = Field(alias="columnName")


class TermFieldMappingListResponse(BaseModel):
    items: list[TermFieldMappingOut]


class TermFieldMappingsReplace(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    items: list[TermFieldMappingItem] = Field(default_factory=list, max_length=64)
