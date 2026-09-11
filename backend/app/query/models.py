from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text, Uuid, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class ChartQueryBinding(Base):
    __tablename__ = "chart_query_bindings"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    data_source_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    mode: Mapped[str] = mapped_column(String(16), nullable=False)
    sql: Mapped[str | None] = mapped_column(Text, nullable=True)
    schema_name: Mapped[str | None] = mapped_column(String(64), nullable=True)
    table_name: Mapped[str | None] = mapped_column(String(64), nullable=True)
    default_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    chart_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True, unique=True, index=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(),
    )


from app.core.db.meta import get_meta_engine, get_meta_session

__all__ = ["Base", "ChartQueryBinding", "get_meta_engine", "get_meta_session"]
