from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator
from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text, Uuid, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.core.crypto.credentials import decrypt_credential, encrypt_credential
from app.core.db.meta import get_meta_engine, get_meta_session
from app.query.rls.guard import validate_identifier

INGESTION_MAX_ROWS = 100_000


class Base(DeclarativeBase):
    pass


class SyncJob(Base):
    __tablename__ = "ingestion_sync_jobs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    source_type: Mapped[str] = mapped_column(String(16), nullable=False)
    source_host: Mapped[str] = mapped_column(String(255), nullable=False)
    source_port: Mapped[int] = mapped_column(Integer, nullable=False)
    source_database: Mapped[str] = mapped_column(String(128), nullable=False)
    source_username: Mapped[str] = mapped_column(String(128), nullable=False)
    source_password_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    source_table: Mapped[str] = mapped_column(String(128), nullable=False)
    source_schema: Mapped[str | None] = mapped_column(String(128), nullable=True)
    target_table: Mapped[str] = mapped_column(String(128), nullable=False)
    schedule_cron: Mapped[str | None] = mapped_column(String(64), nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    source_data_source_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    sync_mode: Mapped[str] = mapped_column(String(16), default="full", nullable=False)
    primary_key: Mapped[str | None] = mapped_column(String(128), nullable=True)
    incremental_column: Mapped[str | None] = mapped_column(String(128), nullable=True)
    last_watermark: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class SyncRun(Base):
    __tablename__ = "ingestion_sync_runs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    job_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("ingestion_sync_jobs.id", ondelete="CASCADE"))
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rows_synced: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    trace_id: Mapped[str] = mapped_column(String(64), nullable=False)
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    rows_truncated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    consume_warning: Mapped[str | None] = mapped_column(Text, nullable=True)


class EtlRuleSet(Base):
    __tablename__ = "ingestion_etl_rules"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    job_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("ingestion_sync_jobs.id", ondelete="CASCADE"), unique=True
    )
    rules: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class SourceConnectionIn(BaseModel):
    type: Literal["mysql", "postgres"]
    host: str
    port: int = Field(ge=1, le=65535)
    database: str
    username: str
    password: str = Field(min_length=1)
    table: str

    @field_validator("table")
    @classmethod
    def validate_table_name(cls, value: str) -> str:
        validate_identifier(value)
        return value


class SourceConnectionUpdateIn(BaseModel):
    type: Literal["mysql", "postgres"]
    host: str
    port: int = Field(ge=1, le=65535)
    database: str
    username: str
    password: str = ""
    table: str

    @field_validator("table")
    @classmethod
    def validate_table_name(cls, value: str) -> str:
        validate_identifier(value)
        return value


class SourceConnectionOut(BaseModel):
    type: str
    host: str
    port: int
    database: str
    source_schema: str | None = Field(default=None, serialization_alias="schema")
    username: str
    password: str = "***"
    table: str

    model_config = {"populate_by_name": True}


def encrypt_password(plain: str) -> str:
    return encrypt_credential(plain)


def decrypt_password(cipher: str) -> str:
    try:
        return decrypt_credential(cipher)
    except Exception as exc:
        raise ValueError("invalid encrypted password") from exc
