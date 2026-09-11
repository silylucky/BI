from __future__ import annotations

import uuid

from pydantic import BaseModel, ConfigDict, Field

META_THEME_FORBIDDEN = "META_THEME_FORBIDDEN"

MAX_THEME_DEPTH = 8


class ThemeError(Exception):
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


class ThemeCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    name: str = Field(min_length=1, max_length=120)
    code: str | None = Field(default=None, max_length=64)
    parent_id: uuid.UUID | None = Field(default=None, alias="parentId")
    term_id: uuid.UUID | None = Field(default=None, alias="termId")
    sort_order: int = Field(default=0, alias="sortOrder")


class ThemeUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    name: str = Field(min_length=1, max_length=120)
    code: str | None = Field(default=None, max_length=64)
    term_id: uuid.UUID | None = Field(default=None, alias="termId")
    sort_order: int | None = Field(default=None, alias="sortOrder")


class ThemeMove(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    parent_id: uuid.UUID | None = Field(default=None, alias="parentId")
    sort_order: int | None = Field(default=None, alias="sortOrder")


class ThemeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
    id: uuid.UUID
    code: str | None
    name: str
    parent_id: uuid.UUID | None = Field(alias="parentId")
    sort_order: int = Field(alias="sortOrder")
    term_id: uuid.UUID | None = Field(alias="termId")


class ThemeListResponse(BaseModel):
    items: list[ThemeOut]
    total: int
