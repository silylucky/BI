from __future__ import annotations

import uuid

from pydantic import BaseModel, ConfigDict, Field


class DashboardExportJobIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    format: str = Field(pattern=r"^(pdf|excel)$")


class DashboardExportJobOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    job_id: uuid.UUID = Field(alias="jobId")
    status: str
    download_url: str | None = Field(default=None, alias="downloadUrl")
    artifact_kind: str | None = Field(default=None, alias="artifactKind")
