from __future__ import annotations

import uuid
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class AiVizManifestIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(min_length=2, max_length=64)
    display_name: str = Field(alias="displayName", min_length=1, max_length=120)
    version: str = Field(default="1.0.0", max_length=32)
    entry: str = Field(default="index.html", max_length=128)
    field_slots: dict[str, Any] | None = Field(default=None, alias="fieldSlots")
    style_schema: dict[str, Any] | None = Field(default=None, alias="styleSchema")
    default_style: dict[str, Any] | None = Field(default=None, alias="defaultStyle")
    runtime: Literal["html", "d3"] | None = None
    renderer_hint: str | None = Field(default=None, alias="rendererHint")


class AiVizArtifactCreateIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    manifest: AiVizManifestIn
    files: dict[str, str] = Field(min_length=1)


class AiVizComplianceWarningOut(BaseModel):
    code: str
    message: str


class AiVizArtifactOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    artifact_id: uuid.UUID = Field(alias="artifactId")
    manifest: dict[str, Any]
    status: str
    content_hash: str = Field(alias="contentHash")
    warnings: list[AiVizComplianceWarningOut] = Field(default_factory=list)
    style_compliance_tier: Literal["full", "partial", "visual-only"] = Field(
        default="visual-only",
        alias="styleComplianceTier",
    )


class AiVizArtifactListOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    items: list[AiVizArtifactOut]


class AiVizArtifactBundleOut(BaseModel):
    """Full bundle for Agent edit round-trip (owner + dashboard:edit)."""

    model_config = ConfigDict(populate_by_name=True)

    artifact_id: uuid.UUID = Field(alias="artifactId")
    manifest: dict[str, Any]
    files: dict[str, str]


class AiVizArtifactReferenceOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    dashboard_id: uuid.UUID = Field(alias="dashboardId")
    dashboard_name: str = Field(alias="dashboardName")
    widget_id: str = Field(alias="widgetId")


class AiVizArtifactReferencesOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    artifact_id: uuid.UUID = Field(alias="artifactId")
    references: list[AiVizArtifactReferenceOut] = Field(default_factory=list)


class AiVizArtifactUnlinkDashboardOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    dashboard_id: uuid.UUID = Field(alias="dashboardId")
    dashboard_name: str = Field(alias="dashboardName")
    removed_widget_ids: list[str] = Field(alias="removedWidgetIds")


class AiVizArtifactDeleteOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    artifact_id: uuid.UUID = Field(alias="artifactId")
    unlinked: list[AiVizArtifactUnlinkDashboardOut] = Field(default_factory=list)
