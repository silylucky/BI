"""Unified report center contract: lifecycle states, job kinds, error domains."""

from __future__ import annotations

from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

RENDER_SPEC_VERSION = "1.0"


class TemplateLifecycle(StrEnum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class ExecutionLifecycle(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    DEGRADED = "degraded"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ArtifactLifecycle(StrEnum):
    BUILDING = "building"
    READY = "ready"
    EXPIRED = "expired"
    DELETED = "deleted"


class ReportJobKind(StrEnum):
    BATCH_EXPORT = "batch_export"
    SCHEDULE_RENDER = "schedule_render"
    TEMPLATE_EXPORT = "template_export"


class ReportJobStatus(StrEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"
    CANCELLED = "cancelled"


class CenterResourceType(StrEnum):
    TEMPLATE = "template"
    STANDARD = "standard"
    SCHEDULE = "schedule"
    DASHBOARD = "dashboard"


class RenderSpecContract(BaseModel):
    """ADR-09 RenderSpec envelope shared by Web/PDF/Excel."""

    model_config = ConfigDict(populate_by_name=True)

    template_node_id: str | None = Field(default=None, alias="templateNodeId")
    engine_version: str = Field(default=RENDER_SPEC_VERSION, alias="engineVersion")
    format: Literal["web", "html", "pdf", "excel"]
    sections: list[dict[str, Any]] = Field(default_factory=list)
    parameters: dict[str, Any] = Field(default_factory=dict)
    rendered_at: str | None = Field(default=None, alias="renderedAt")


class ReportCenterPreferencesOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    favorites: list[dict[str, str]] = Field(default_factory=list)
    recent: list[dict[str, str]] = Field(default_factory=list)
