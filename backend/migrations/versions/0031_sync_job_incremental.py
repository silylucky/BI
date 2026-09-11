"""sync job incremental + datasource reference columns

Revision ID: 0031
Revises: 0030
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0031"
down_revision: Union[str, None] = "0030"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "ingestion_sync_jobs",
        sa.Column("sync_mode", sa.String(length=16), nullable=False, server_default="full"),
    )
    op.add_column(
        "ingestion_sync_jobs",
        sa.Column("primary_key", sa.String(length=128), nullable=True),
    )
    op.add_column(
        "ingestion_sync_jobs",
        sa.Column("incremental_column", sa.String(length=128), nullable=True),
    )
    op.add_column(
        "ingestion_sync_jobs",
        sa.Column("last_watermark", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("ingestion_sync_jobs", "last_watermark")
    op.drop_column("ingestion_sync_jobs", "incremental_column")
    op.drop_column("ingestion_sync_jobs", "primary_key")
    op.drop_column("ingestion_sync_jobs", "sync_mode")
