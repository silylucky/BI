"""ORM models for report schedules, executions, export jobs, and export tokens."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.datasources.models import Base


class ReportSchedule(Base):
    __tablename__ = "report_schedules"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    catalog_node_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True, index=True)
    source_type: Mapped[str] = mapped_column(String(32), nullable=False, default="template")
    source_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True, index=True)
    source_key: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    owner_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    recipients: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    attachment_formats: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    delivery_channels: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    email_smtp_slot: Mapped[str] = mapped_column(String(8), nullable=False, default="qq")
    cron: Mapped[str] = mapped_column(String(64), nullable=False)
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="Asia/Shanghai")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(),
    )


class ReportScheduleExecution(Base):
    __tablename__ = "report_schedule_executions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    schedule_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(64), nullable=False)
    artifact_ref: Mapped[str] = mapped_column(Text, nullable=False)
    artifact_kind: Mapped[str | None] = mapped_column(String(64), nullable=True)
    artifact_storage_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    secondary_artifacts: Mapped[list | None] = mapped_column(JSON, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    delivery_steps: Mapped[list | None] = mapped_column(JSON, nullable=True)
    idempotency_key: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    parent_execution_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    revision_snapshot: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    executed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DashboardExportJob(Base):
    __tablename__ = "dashboard_export_jobs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    dashboard_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    owner_id: Mapped[str] = mapped_column(String(64), nullable=False)
    fmt: Mapped[str] = mapped_column(String(16), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="ready")
    artifact_kind: Mapped[str | None] = mapped_column(String(64), nullable=True)
    storage_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ExportToken(Base):
    __tablename__ = "export_tokens"

    token: Mapped[str] = mapped_column(String(128), primary_key=True)
    dashboard_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ScheduleTickLock(Base):
    __tablename__ = "report_schedule_tick_locks"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    schedule_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    tick_key: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    acquired_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ReportJob(Base):
    __tablename__ = "report_jobs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    job_kind: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    owner_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending", index=True)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    result_storage_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    content_type: Mapped[str | None] = mapped_column(String(128), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    lease_owner: Mapped[str | None] = mapped_column(String(64), nullable=True)
    lease_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    poll_count: Mapped[int] = mapped_column(nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(),
    )


class ReportUserFavorite(Base):
    __tablename__ = "report_user_favorites"

    user_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    resource_type: Mapped[str] = mapped_column(String(32), primary_key=True)
    resource_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ReportRecentView(Base):
    __tablename__ = "report_recent_views"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    resource_type: Mapped[str] = mapped_column(String(32), nullable=False)
    resource_id: Mapped[str] = mapped_column(String(64), nullable=False)
    resource_label: Mapped[str | None] = mapped_column(String(255), nullable=True)
    viewed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class ReportDismissedFailure(Base):
    __tablename__ = "report_dismissed_failures"

    user_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    execution_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    dismissed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ReportDeliveryAttempt(Base):
    __tablename__ = "report_delivery_attempts"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    execution_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    channel: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    response_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    attempted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
