from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class TileServiceOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    id: str
    name: str
    base_url: str = Field(alias="baseUrl")
    pmtiles_path: str = Field(alias="pmtilesPath")
    glyphs_url_template: str | None = Field(default=None, alias="glyphsUrlTemplate")
    sprite_url: str | None = Field(default=None, alias="spriteUrl")
    enabled: bool
    description: str | None = None


class TileServiceListItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    id: str
    name: str
    enabled: bool


class TileServiceListResponse(BaseModel):
    items: list[TileServiceListItem]


class TileServiceResolveOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    id: str
    name: str
    pmtiles_url: str = Field(alias="pmtilesUrl")
    glyphs_url: str = Field(alias="glyphsUrl")
    sprite_url: str = Field(alias="spriteUrl")


class TileServiceCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    id: str = Field(min_length=2, max_length=64, pattern=r"^[a-z0-9][a-z0-9_-]*$")
    name: str = Field(min_length=1, max_length=120)
    base_url: str = Field(alias="baseUrl", min_length=1, max_length=512)
    pmtiles_path: str = Field(alias="pmtilesPath", min_length=1, max_length=512)
    glyphs_url_template: str | None = Field(default=None, alias="glyphsUrlTemplate")
    sprite_url: str | None = Field(default=None, alias="spriteUrl")
    enabled: bool = True
    description: str | None = None


class TileServicePatch(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    name: str | None = Field(default=None, min_length=1, max_length=120)
    base_url: str | None = Field(default=None, alias="baseUrl", min_length=1, max_length=512)
    pmtiles_path: str | None = Field(default=None, alias="pmtilesPath", min_length=1, max_length=512)
    glyphs_url_template: str | None = Field(default=None, alias="glyphsUrlTemplate")
    sprite_url: str | None = Field(default=None, alias="spriteUrl")
    enabled: bool | None = None
    description: str | None = None
