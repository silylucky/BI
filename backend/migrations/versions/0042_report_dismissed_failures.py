"""report dismissed schedule failures per user

Revision ID: 0042
Revises: 0041
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0042"
down_revision: Union[str, None] = "0041"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "report_dismissed_failures",
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("execution_id", sa.Uuid(), nullable=False),
        sa.Column("dismissed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("user_id", "execution_id"),
    )


def downgrade() -> None:
    op.drop_table("report_dismissed_failures")
