from __future__ import annotations

import uuid

from sqlalchemy import JSON, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.datasources.models import Base


class PhysicalTableRecord(Base):
    __tablename__ = "physical_tables"
    __table_args__ = (
        UniqueConstraint(
            "data_source_id",
            "source_schema",
            "source_table",
            name="uq_physical_ds_schema_table",
        ),
    )

    table_fqn: Mapped[str] = mapped_column(String(128), primary_key=True)
    data_source_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    entity_type_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    columns: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    source_schema: Mapped[str | None] = mapped_column(String(128), nullable=True)
    source_table: Mapped[str | None] = mapped_column(String(128), nullable=True)
