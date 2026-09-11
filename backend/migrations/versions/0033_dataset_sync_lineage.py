"""dataset sync job lineage (origin + sync_job_id)

Revision ID: 0033
Revises: 0032
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0033"
down_revision: Union[str, None] = "0032"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "datasets",
        sa.Column("origin", sa.String(length=16), nullable=False, server_default="manual"),
    )
    op.add_column("datasets", sa.Column("sync_job_id", sa.Uuid(), nullable=True))
    op.create_index("ix_datasets_sync_job_id", "datasets", ["sync_job_id"])


def downgrade() -> None:
    op.drop_index("ix_datasets_sync_job_id", table_name="datasets")
    op.drop_column("datasets", "sync_job_id")
    op.drop_column("datasets", "origin")
