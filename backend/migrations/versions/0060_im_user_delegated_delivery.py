"""IM user-delegated delivery mode + per-user OAuth tokens

Revision ID: 0060
Revises: 0059
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0060"
down_revision: str | None = "0059"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

IM_DELIVERY_MODES = ("corporate_app", "user_delegated")


def upgrade() -> None:
    with op.batch_alter_table("platform_im_connect_configs") as batch:
        batch.add_column(
            sa.Column(
                "delivery_mode",
                sa.String(length=32),
                nullable=False,
                server_default="corporate_app",
            ),
        )
        batch.create_check_constraint(
            "ck_platform_im_connect_configs_delivery_mode",
            "delivery_mode IN ('corporate_app', 'user_delegated')",
        )
    with op.batch_alter_table("user_im_bindings") as batch:
        batch.add_column(sa.Column("token_encrypted", sa.Text(), nullable=True))
        batch.add_column(sa.Column("token_expires_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("user_im_bindings") as batch:
        batch.drop_column("token_expires_at")
        batch.drop_column("token_encrypted")
    with op.batch_alter_table("platform_im_connect_configs") as batch:
        batch.drop_constraint("ck_platform_im_connect_configs_delivery_mode", type_="check")
        batch.drop_column("delivery_mode")
