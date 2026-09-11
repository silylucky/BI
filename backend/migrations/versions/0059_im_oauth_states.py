"""im_oauth_states for IM authorize callback

Revision ID: 0059
Revises: 0058
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0059"
down_revision: Union[str, None] = "0058"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "im_oauth_states",
        sa.Column("state", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("channel", sa.String(length=16), nullable=False),
        sa.Column("redirect_after", sa.String(length=512), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["auth_users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("state"),
    )
    op.create_index("ix_im_oauth_states_expires_at", "im_oauth_states", ["expires_at"])


def downgrade() -> None:
    op.drop_index("ix_im_oauth_states_expires_at", table_name="im_oauth_states")
    op.drop_table("im_oauth_states")
