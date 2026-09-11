from __future__ import annotations

import uuid
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

ThemeType = Literal["lifecycle", "activity", "trend", "distribution"]
SnapshotCronPreset = Literal["daily", "weekly", "monthly"]
PeriodKind = Literal["daily", "weekly", "monthly"]


class FieldMapping(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    status: str | None = None
    region: str | None = None
    created_at: str | None = Field(default=None, alias="createdAt")


class AnalysisPackIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    pack_key: str = Field(alias="packKey", pattern=r"^[a-z][a-z0-9_-]{1,63}$")
    display_name: str = Field(min_length=1, max_length=120, alias="displayName")
    business_object_code: str | None = Field(
        default=None,
        alias="businessObjectCode",
        pattern=r"^[a-z][a-z0-9_]{1,63}$",
    )
    physical_table_fqn: str | None = Field(default=None, alias="physicalTableFqn", min_length=3, max_length=128)
    dataset_id: str | None = Field(default=None, alias="datasetId", pattern=r"^[a-z][a-z0-9_-]{1,63}$")
    bound_config_id: uuid.UUID | None = Field(default=None, alias="boundConfigId")
    data_source_id: uuid.UUID = Field(alias="dataSourceId")
    field_mapping: FieldMapping = Field(alias="fieldMapping")
    enabled_themes: list[ThemeType] = Field(min_length=1, alias="enabledThemes")
    allowed_roles: list[str] = Field(default_factory=lambda: ["analyst"], alias="allowedRoles")
    snapshot_cron_preset: SnapshotCronPreset = Field(alias="snapshotCronPreset")
    snapshot_retention_periods: int = Field(
        default=12,
        ge=1,
        le=120,
        alias="snapshotRetentionPeriods",
    )

    @model_validator(mode="after")
    def _binding_mode(self) -> AnalysisPackIn:
        if not self.dataset_id:
            raise ValueError("datasetId is required")
        if not self.bound_config_id:
            raise ValueError("boundConfigId is required")
        return self


class AnalysisPackOut(AnalysisPackIn):
    pass


class AnalysisPackListResponse(BaseModel):
    items: list[AnalysisPackOut]
    total: int


class ThemeCapability(BaseModel):
    theme: ThemeType
    available: bool
    reason: str | None = None


class CapabilitiesOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    pack_key: str = Field(alias="packKey")
    themes: list[ThemeCapability]
    columns: list[str]


from app.reports.standard.volume_policy import DEFAULT_QUERY_LIMIT, MAX_QUERY_LIMIT


class RunIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    theme: ThemeType
    parameters: dict[str, Any] = Field(default_factory=dict)
    limit: int = Field(default=DEFAULT_QUERY_LIMIT, ge=1, le=MAX_QUERY_LIMIT)


class RunOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    pack_key: str = Field(alias="packKey")
    theme: ThemeType
    render_spec: dict[str, Any] = Field(alias="renderSpec")
    data_source_id: uuid.UUID = Field(alias="dataSourceId")
    status: Literal["ready"] = "ready"


class SnapshotOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: uuid.UUID
    pack_key: str = Field(alias="packKey")
    theme: ThemeType
    period_kind: PeriodKind = Field(alias="periodKind")
    period_key: str = Field(alias="periodKey")
    captured_at: str = Field(alias="capturedAt")
    payload: dict[str, Any]


class SnapshotListResponse(BaseModel):
    items: list[SnapshotOut]
    total: int


class CompareDeltaRow(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    key: str
    current_value: float = Field(alias="currentValue")
    previous_value: float | None = Field(default=None, alias="previousValue")
    delta: float | None = None
    delta_pct: float | None = Field(default=None, alias="deltaPct")


class CompareOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    pack_key: str = Field(alias="packKey")
    theme: ThemeType
    current_period_key: str = Field(alias="currentPeriodKey")
    previous_period_key: str | None = Field(default=None, alias="previousPeriodKey")
    current_source: Literal["live", "snapshot"] = Field(default="live", alias="currentSource")
    current: dict[str, Any]
    previous: dict[str, Any] | None = None
    deltas: list[CompareDeltaRow] = Field(default_factory=list)


class CompareMatrixRow(BaseModel):
    key: str
    values: dict[str, float]


class CompareMatrixOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    pack_key: str = Field(alias="packKey")
    theme: ThemeType
    period_kind: PeriodKind = Field(alias="periodKind")
    period_keys: list[str] = Field(alias="periodKeys")
    rows: list[CompareMatrixRow]
