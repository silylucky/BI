from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

SurfaceKind = Literal["dashboard", "data-screen"]
TemplateStatus = Literal["draft", "published", "archived"]
TemplateVisibility = Literal["builtin", "org", "private"]


class DashboardTemplateOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    id: uuid.UUID
    template_key: str = Field(alias="templateKey")
    name: str
    description: str | None = None
    category_key: str = Field(alias="categoryKey")
    surface_kind: SurfaceKind = Field(alias="surfaceKind")
    status: TemplateStatus
    layout_json: dict[str, Any] = Field(alias="layoutJson")
    thumbnail_ref: str | None = Field(default=None, alias="thumbnailRef")
    source_dashboard_id: uuid.UUID | None = Field(default=None, alias="sourceDashboardId")
    visibility: TemplateVisibility
    owner_user_id: uuid.UUID | None = Field(default=None, alias="ownerUserId")
    org_scope: str | None = Field(default=None, alias="orgScope")
    content_revision: int = Field(alias="contentRevision")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")
    published_at: datetime | None = Field(default=None, alias="publishedAt")


class DashboardTemplateListItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    id: uuid.UUID
    template_key: str = Field(alias="templateKey")
    name: str
    description: str | None = None
    category_key: str = Field(alias="categoryKey")
    surface_kind: SurfaceKind = Field(alias="surfaceKind")
    status: TemplateStatus
    thumbnail_ref: str | None = Field(default=None, alias="thumbnailRef")
    visibility: TemplateVisibility
    content_revision: int = Field(alias="contentRevision")
    updated_at: datetime = Field(alias="updatedAt")
    published_at: datetime | None = Field(default=None, alias="publishedAt")


class DashboardTemplateListResponse(BaseModel):
    items: list[DashboardTemplateListItem]
    total: int
    limit: int
    offset: int


class DashboardTemplateCreateIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    category_key: str = Field(default="general", alias="categoryKey", max_length=64)
    surface_kind: SurfaceKind = Field(alias="surfaceKind")
    layout_json: dict[str, Any] | None = Field(default=None, alias="layoutJson")
    source_dashboard_id: uuid.UUID | None = Field(default=None, alias="sourceDashboardId")
    visibility: TemplateVisibility = "private"
    org_scope: str | None = Field(default=None, alias="orgScope", max_length=128)
    thumbnail_ref: str | None = Field(default=None, alias="thumbnailRef", max_length=512)


class DashboardTemplateUpdateIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    category_key: str | None = Field(default=None, alias="categoryKey", max_length=64)
    layout_json: dict[str, Any] | None = Field(default=None, alias="layoutJson")
    visibility: TemplateVisibility | None = None
    org_scope: str | None = Field(default=None, alias="orgScope", max_length=128)
    thumbnail_ref: str | None = Field(default=None, alias="thumbnailRef", max_length=512)
    content_revision: int | None = Field(default=None, alias="contentRevision", ge=1)


class VizLayoutEnvelopeIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="allow")

    template_version: int = Field(alias="templateVersion")
    kind: str
    surface_kind: SurfaceKind | None = Field(default=None, alias="surfaceKind")
    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    category_key: str | None = Field(default=None, alias="categoryKey", max_length=64)
    layout: dict[str, Any]


class DashboardFromTemplateIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    template_id: uuid.UUID = Field(alias="templateId")
    name: str | None = Field(default=None, max_length=120)
    slug: str | None = Field(default=None, max_length=64)
