from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, JSON, String, UniqueConstraint, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.datasources.models import Base


class ViewRoleDefault(Base):
    __tablename__ = "view_role_defaults"

    role_key: Mapped[str] = mapped_column(String(128), primary_key=True)
    dashboard_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    report_template_node_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    max_widget_count: Mapped[int] = mapped_column(Integer, nullable=False, default=24)
    inherit_from_role_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


class ViewUserOverride(Base):
    __tablename__ = "view_user_overrides"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_view_user_override_name"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    user_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    dashboard_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    layout_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    classification_scope: Mapped[str | None] = mapped_column(String(32), nullable=True)
    inherited_from_role: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
