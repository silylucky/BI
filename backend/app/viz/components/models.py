from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, Integer, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.datasources.models import Base


class VizComponent(Base):
    __tablename__ = "viz_components"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    component_key: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category_key: Mapped[str] = mapped_column(String(64), nullable=False, default="general")
    widget_type: Mapped[str] = mapped_column(String(32), nullable=False)
    surface_kinds: Mapped[list] = mapped_column(JSON, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")
    payload_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    thumbnail_ref: Mapped[str | None] = mapped_column(String(512), nullable=True)
    tags: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    visibility: Mapped[str] = mapped_column(String(32), nullable=False, default="private")
    owner_user_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True, index=True)
    org_scope: Mapped[str | None] = mapped_column(String(128), nullable=True)
    content_revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(),
    )
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
