from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.datasources.models import Base


class GovOpenApiMapping(Base):
    __tablename__ = "gov_openapi_mappings"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    catalog_entry_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    http_method: Mapped[str] = mapped_column(String(16), nullable=False)
    path: Mapped[str] = mapped_column(String(512), nullable=False)
    operation_id: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    entity_type_ref: Mapped[str | None] = mapped_column(String(64), nullable=True)
    api_version: Mapped[str] = mapped_column(String(16), nullable=False, default="v1")
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class GovGeoRegion(Base):
    __tablename__ = "gov_geo_regions"

    region_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    region_code: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True, index=True)
    level: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class GovClassificationNode(Base):
    __tablename__ = "gov_classification_nodes"

    node_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    code: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True, index=True)
    kind: Mapped[str] = mapped_column(String(32), nullable=False, default="category")
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class GovPublishSubmitter(Base):
    __tablename__ = "gov_publish_submitters"

    entry_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    submitter_id: Mapped[str] = mapped_column(String(128), nullable=False)
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
