from __future__ import annotations

from sqlalchemy import Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.datasources.models import Base


class EntityTypeRecord(Base):
    __tablename__ = "entity_types"

    type_code: Mapped[str] = mapped_column(String(64), primary_key=True)
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    attributes: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    lifecycle_states: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    physical_table_fqn: Mapped[str | None] = mapped_column(String(128), nullable=True)
    ref_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
