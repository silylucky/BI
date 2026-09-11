"""sync job source_schema for PostgreSQL-family sync

Revision ID: 0037
Revises: 0036
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0037"
down_revision: Union[str, None] = "0036"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_PG_SOURCE_TYPES = ("postgresql", "timescaledb", "kingbase", "gaussdb", "redshift")


def upgrade() -> None:
    op.add_column(
        "ingestion_sync_jobs",
        sa.Column("source_schema", sa.String(length=128), nullable=True),
    )
    types_sql = ", ".join(f"'{value}'" for value in _PG_SOURCE_TYPES)
    op.execute(
        f"""
        UPDATE ingestion_sync_jobs
        SET source_schema = 'public'
        WHERE source_schema IS NULL
          AND source_type IN ({types_sql})
        """
    )


def downgrade() -> None:
    op.drop_column("ingestion_sync_jobs", "source_schema")
