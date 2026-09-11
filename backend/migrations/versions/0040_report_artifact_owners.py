"""report artifact owners persistence

Revision ID: 0040
Revises: 0039
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0040"
down_revision: Union[str, None] = "0039"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "report_artifact_owners",
        sa.Column("artifact_ref", sa.String(length=512), nullable=False),
        sa.Column("owner_id", sa.String(length=64), nullable=False),
        sa.PrimaryKeyConstraint("artifact_ref"),
    )


def downgrade() -> None:
    op.drop_table("report_artifact_owners")
