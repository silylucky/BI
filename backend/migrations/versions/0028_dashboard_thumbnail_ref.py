"""dashboards.thumbnail_ref for list screenshot previews

Revision ID: 0028
Revises: 0027
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0028"
down_revision: Union[str, None] = "0027"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "dashboards",
        sa.Column("thumbnail_ref", sa.String(length=512), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("dashboards", "thumbnail_ref")
