"""sync run truncation and consume warning columns

Revision ID: 0056
Revises: 0055
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from migrations.dialect_ops import bool_false_default

revision: str = "0056"
down_revision: Union[str, None] = "0055"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    bool_false = bool_false_default(bind)
    op.add_column(
        "ingestion_sync_runs",
        sa.Column("rows_truncated", sa.Boolean(), server_default=bool_false, nullable=False),
    )
    op.add_column(
        "ingestion_sync_runs",
        sa.Column("consume_warning", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("ingestion_sync_runs", "consume_warning")
    op.drop_column("ingestion_sync_runs", "rows_truncated")
