"""user_im_bindings source + unique account constraint

Revision ID: 0058
Revises: 0057
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0058"
down_revision: str | None = "0057"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("user_im_bindings") as batch:
        batch.add_column(
            sa.Column("source", sa.String(length=16), nullable=False, server_default="oauth"),
        )
        batch.create_unique_constraint(
            "uq_user_im_bindings_channel_account",
            ["channel", "account_id"],
        )


def downgrade() -> None:
    with op.batch_alter_table("user_im_bindings") as batch:
        batch.drop_constraint("uq_user_im_bindings_channel_account", type_="unique")
        batch.drop_column("source")
