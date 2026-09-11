from __future__ import annotations

import uuid
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator
from app.core.platform_config.slots import EMAIL_SLOT_QQ


class ScheduleRecipientIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    type: Literal["role", "user", "email"]
    value: str = Field(min_length=1, max_length=255)


class ScheduleCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    catalog_node_id: uuid.UUID | None = Field(default=None, alias="catalogNodeId")
    source_type: Literal["template", "dashboard", "data_screen", "standard"] = Field(
        default="template", alias="sourceType",
    )
    source_id: uuid.UUID | None = Field(default=None, alias="sourceId")
    source_key: str | None = Field(default=None, alias="sourceKey", max_length=64)
    recipients: list[ScheduleRecipientIn] = Field(default_factory=list)
    attachment_formats: list[Literal["pdf", "excel"]] = Field(
        default_factory=lambda: ["pdf"], alias="attachmentFormats",
    )
    delivery_channels: list[Literal["email"]] = Field(
        default_factory=lambda: ["email"], alias="deliveryChannels",
    )
    email_smtp_slot: Literal["qq", "163"] = Field(default=EMAIL_SLOT_QQ, alias="emailSmtpSlot")
    name: str | None = Field(default=None, max_length=120)
    cron: str = Field(min_length=1, max_length=64)
    timezone: str = Field(default="Asia/Shanghai", max_length=64)

    @model_validator(mode="after")
    def resolve_source(self) -> ScheduleCreate:
        if self.source_type == "standard":
            key = (self.source_key or "").strip()
            if not key:
                raise ValueError("sourceKey required for standard schedules")
            return self.model_copy(
                update={"source_key": key, "source_id": None, "catalog_node_id": None},
            )
        source_id = self.source_id or self.catalog_node_id
        if source_id is None:
            raise ValueError("sourceId or catalogNodeId required")
        updates: dict[str, Any] = {"source_id": source_id}
        if self.source_type == "template" and self.catalog_node_id is None:
            updates["catalog_node_id"] = source_id
        return self.model_copy(update=updates)


class ScheduleTransitionIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    action: Literal["schedule", "pause", "resume", "cancel"]


class ScheduleUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    name: str | None = Field(default=None, max_length=120)
    cron: str | None = Field(default=None, min_length=1, max_length=64)
    timezone: str | None = Field(default=None, max_length=64)
    recipients: list[ScheduleRecipientIn] | None = None
    attachment_formats: list[Literal["pdf", "excel"]] | None = Field(default=None, alias="attachmentFormats")
    delivery_channels: list[Literal["email"]] | None = Field(
        default=None, alias="deliveryChannels",
    )
    email_smtp_slot: Literal["qq", "163"] | None = Field(default=None, alias="emailSmtpSlot")


class ScheduleStatusOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: uuid.UUID
    name: str | None = None
    catalog_node_id: uuid.UUID | None = Field(default=None, alias="catalogNodeId")
    source_type: str = Field(default="template", alias="sourceType")
    source_id: uuid.UUID | None = Field(default=None, alias="sourceId")
    source_key: str | None = Field(default=None, alias="sourceKey")
    source_label: str | None = Field(default=None, alias="sourceLabel")
    recipients: list[ScheduleRecipientIn] = Field(default_factory=list)
    attachment_formats: list[str] = Field(default_factory=list, alias="attachmentFormats")
    delivery_channels: list[str] = Field(default_factory=lambda: ["email"], alias="deliveryChannels")
    email_smtp_slot: str = Field(default=EMAIL_SLOT_QQ, alias="emailSmtpSlot")
    cron: str
    timezone: str
    status: str
    allowed_actions: list[str] = Field(alias="allowedActions")


class ScheduleListOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    items: list[ScheduleStatusOut]
    total: int


class ExecutionHistoryItemOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    execution_id: uuid.UUID = Field(alias="executionId")
    schedule_id: uuid.UUID = Field(alias="scheduleId")
    status: str
    artifact_ref: str = Field(alias="artifactRef")
    artifact_kind: str | None = Field(default=None, alias="artifactKind")
    executed_at: str = Field(alias="executedAt")
    error_message: str | None = Field(default=None, alias="errorMessage")
    parent_execution_id: uuid.UUID | None = Field(default=None, alias="parentExecutionId")


class ExecutionHistoryOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    items: list[ExecutionHistoryItemOut]
    total: int


class RetryExecutionOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    execution_id: uuid.UUID = Field(alias="executionId")
    parent_execution_id: uuid.UUID = Field(alias="parentExecutionId")
    status: str
    artifact_ref: str = Field(alias="artifactRef")
    executed_at: str = Field(alias="executedAt")


class ScheduleExecuteOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    execution_id: uuid.UUID = Field(alias="executionId")
    schedule_id: uuid.UUID = Field(alias="scheduleId")
    status: Literal[
        "succeeded",
        "failed",
        "delivery_degraded",
        "skipped",
        "pending",
        "mock_succeeded",
        "mock_skipped",
        "semi_real_succeeded",
        "semi_real_delivery_degraded",
        "semi_real_failed",
    ]
    artifact_ref: str = Field(alias="artifactRef")
    artifact_kind: str | None = Field(default=None, alias="artifactKind")
    secondary_artifacts: list[dict[str, Any]] = Field(default_factory=list, alias="secondaryArtifacts")
    idempotency_key: str = Field(alias="idempotencyKey")
    executed_at: str = Field(alias="executedAt")
    delivery_steps: list[dict[str, Any]] = Field(default_factory=list, alias="deliverySteps")
    revision_snapshot: dict | None = Field(default=None, alias="revisionSnapshot")
    error_message: str | None = Field(default=None, alias="errorMessage")
    parent_execution_id: uuid.UUID | None = Field(default=None, alias="parentExecutionId")
