from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

MAX_CLASS_DEPTH = 8


class ClassificationNodeCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    code: str = Field(pattern=r"^[A-Z][A-Z0-9_]{1,31}$")
    name: str = Field(min_length=1, max_length=120)
    parent_id: uuid.UUID | None = Field(default=None, alias="parentId")
    kind: Literal["folder", "leaf"] = "folder"
    sort_order: int = Field(default=0, alias="sortOrder")


class ClassificationNodeMove(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    parent_id: uuid.UUID | None = Field(default=None, alias="parentId")
    sort_order: int | None = Field(default=None, alias="sortOrder")


class ClassificationNodeOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    node_id: uuid.UUID = Field(alias="nodeId")
    code: str
    name: str
    parent_id: uuid.UUID | None = Field(alias="parentId")
    kind: Literal["folder", "leaf"]
    sort_order: int = Field(alias="sortOrder")


class ClassificationNodeListResponse(BaseModel):
    items: list[ClassificationNodeOut]
    total: int
