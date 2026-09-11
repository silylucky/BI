"""report_schedules.source_key for standard analysis delivery

Revision ID: 0046
Revises: 0045
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0046"
down_revision: Union[str, None] = "0045"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("report_schedules", schema=None) as batch_op:
        batch_op.add_column(sa.Column("source_key", sa.String(length=64), nullable=True))
        batch_op.alter_column("source_id", existing_type=sa.Uuid(), nullable=True)
    op.create_index("ix_report_schedules_source_key", "report_schedules", ["source_key"])


def downgrade() -> None:
    op.drop_index("ix_report_schedules_source_key", table_name="report_schedules")
    with op.batch_alter_table("report_schedules", schema=None) as batch_op:
        batch_op.alter_column("source_id", existing_type=sa.Uuid(), nullable=False)
        batch_op.drop_column("source_key")
