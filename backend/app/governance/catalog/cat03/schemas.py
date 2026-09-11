from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

MAX_GEO_DEPTH = 6
GeoLevel = Literal["country", "province", "city"]


class GeoRegionCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    region_code: str = Field(alias="regionCode", pattern=r"^[A-Z]{2}(-[A-Z0-9]{1,8})*$")
    name: str = Field(min_length=1, max_length=120)
    parent_id: uuid.UUID | None = Field(default=None, alias="parentId")
    level: GeoLevel = "province"
    sort_order: int = Field(default=0, alias="sortOrder")


class GeoRegionMove(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    parent_id: uuid.UUID | None = Field(default=None, alias="parentId")
    sort_order: int | None = Field(default=None, alias="sortOrder")


class GeoRegionOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    region_id: uuid.UUID = Field(alias="regionId")
    region_code: str = Field(alias="regionCode")
    name: str
    parent_id: uuid.UUID | None = Field(alias="parentId")
    level: GeoLevel
    sort_order: int = Field(alias="sortOrder")


class GeoRegionListResponse(BaseModel):
    items: list[GeoRegionOut]
    total: int
