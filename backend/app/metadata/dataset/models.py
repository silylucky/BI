from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.datasources.models import Base


class DatasetRecord(Base):
    """Persisted Dataset metadata (META-004); replaces in-memory `_store`."""

    __tablename__ = "datasets"

    dataset_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    tables: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    computed_fields: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    allowed_roles: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    table_source_datasource_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    bound_config_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    origin: Mapped[str] = mapped_column(String(16), nullable=False, default="manual", server_default="manual")
    sync_job_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    transform_rules: Mapped[list] = mapped_column(JSON, nullable=False, default=list, server_default="[]")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False,
    )
