from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class CatalogNodeCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    name: str = Field(min_length=1, max_length=120)
    parent_id: uuid.UUID | None = Field(default=None, alias="parentId")
    node_type: Literal["folder", "template"] = Field(default="folder", alias="nodeType")
    template_kind: Literal["excel", "pdf"] | None = Field(default=None, alias="templateKind")
    template_key: str | None = Field(default=None, alias="templateKey", pattern=r"^[a-z][a-z0-9_-]{1,63}$")
    sort_order: int = Field(default=0, alias="sortOrder")


class CatalogNodeMove(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    parent_id: uuid.UUID | None = Field(default=None, alias="parentId")


class CatalogNodeUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    name: str | None = Field(default=None, min_length=1, max_length=120)
    sort_order: int | None = Field(default=None, alias="sortOrder")


class CatalogNodeOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: uuid.UUID
    name: str
    parent_id: uuid.UUID | None = Field(alias="parentId")
    node_type: str = Field(alias="nodeType")
    template_kind: str | None = Field(default=None, alias="templateKind")
    template_key: str | None = Field(default=None, alias="templateKey")
    sort_order: int = Field(alias="sortOrder")
