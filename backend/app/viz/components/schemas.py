from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

SurfaceKind = Literal["dashboard", "data-screen"]
ComponentStatus = Literal["draft", "published", "archived"]
ComponentVisibility = Literal["org", "private"]
WidgetType = Literal["chart", "filter", "text", "media", "customViz"]


class VizComponentRef(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    component_id: uuid.UUID = Field(alias="componentId")
    pinned_revision: int | None = Field(default=None, alias="pinnedRevision", ge=1)
    detached: bool | None = None


class VizComponentOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: uuid.UUID
    component_key: str = Field(alias="componentKey")
    name: str
    description: str | None = None
    category_key: str = Field(alias="categoryKey")
    widget_type: WidgetType = Field(alias="widgetType")
    surface_kinds: list[SurfaceKind] = Field(alias="surfaceKinds")
    status: ComponentStatus
    payload_json: dict[str, Any] = Field(alias="payloadJson")
    thumbnail_ref: str | None = Field(default=None, alias="thumbnailRef")
    thumbnail_url: str | None = Field(default=None, alias="thumbnailUrl")
    tags: list[str] = Field(default_factory=list)
    visibility: ComponentVisibility
    owner_user_id: uuid.UUID | None = Field(default=None, alias="ownerUserId")
    org_scope: str | None = Field(default=None, alias="orgScope")
    content_revision: int = Field(alias="contentRevision")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")
    published_at: datetime | None = Field(default=None, alias="publishedAt")


class VizComponentListItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: uuid.UUID
    component_key: str = Field(alias="componentKey")
    name: str
    description: str | None = None
    category_key: str = Field(alias="categoryKey")
    widget_type: WidgetType = Field(alias="widgetType")
    surface_kinds: list[SurfaceKind] = Field(alias="surfaceKinds")
    status: ComponentStatus
    thumbnail_ref: str | None = Field(default=None, alias="thumbnailRef")
    thumbnail_url: str | None = Field(default=None, alias="thumbnailUrl")
    tags: list[str] = Field(default_factory=list)
    visibility: ComponentVisibility
    content_revision: int = Field(alias="contentRevision")
    reference_count: int = Field(default=0, alias="referenceCount", ge=0)
    updated_at: datetime = Field(alias="updatedAt")
    published_at: datetime | None = Field(default=None, alias="publishedAt")


class VizComponentListResponse(BaseModel):
    items: list[VizComponentListItem]
    total: int
    limit: int
    offset: int


class VizComponentCreateIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    category_key: str = Field(default="general", alias="categoryKey", max_length=64)
    widget_type: WidgetType = Field(alias="widgetType")
    surface_kinds: list[SurfaceKind] = Field(default_factory=lambda: ["dashboard"], alias="surfaceKinds")
    payload_json: dict[str, Any] | None = Field(default=None, alias="payloadJson")
    source_widget: dict[str, Any] | None = Field(default=None, alias="sourceWidget")
    visibility: ComponentVisibility = "private"
    org_scope: str | None = Field(default=None, alias="orgScope", max_length=128)
    thumbnail_ref: str | None = Field(default=None, alias="thumbnailRef", max_length=512)
    tags: list[str] = Field(default_factory=list, max_length=16)


class VizComponentUpdateIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    category_key: str | None = Field(default=None, alias="categoryKey", max_length=64)
    surface_kinds: list[SurfaceKind] | None = Field(default=None, alias="surfaceKinds")
    payload_json: dict[str, Any] | None = Field(default=None, alias="payloadJson")
    visibility: ComponentVisibility | None = None
    org_scope: str | None = Field(default=None, alias="orgScope", max_length=128)
    thumbnail_ref: str | None = Field(default=None, alias="thumbnailRef", max_length=512)
    tags: list[str] | None = Field(default=None, max_length=16)
    content_revision: int | None = Field(default=None, alias="contentRevision", ge=1)


class VizComponentBatchResolveIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    ids: list[uuid.UUID] = Field(min_length=1, max_length=64)


class VizComponentBatchResolveResponse(BaseModel):
    items: list[VizComponentOut]


class VizComponentReferenceItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    dashboard_id: uuid.UUID = Field(alias="dashboardId")
    dashboard_name: str = Field(alias="dashboardName")
    dashboard_surface_kind: SurfaceKind = Field(alias="dashboardSurfaceKind")
    widget_id: str = Field(alias="widgetId")
    widget_title: str | None = Field(default=None, alias="widgetTitle")


class VizComponentReferencesResponse(BaseModel):
    items: list[VizComponentReferenceItem]
    total: int
