"""Drop IM delivery tables and report_schedules.notify_group.

Revision ID: 0065
Revises: 0064
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0065"
down_revision: Union[str, None] = "0064"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index("ix_im_oauth_states_expires_at", table_name="im_oauth_states")
    op.drop_table("im_oauth_states")
    op.drop_index("ix_user_im_bindings_user_id", table_name="user_im_bindings")
    op.drop_table("user_im_bindings")
    op.drop_table("platform_im_connect_configs")
    with op.batch_alter_table("report_schedules") as batch_op:
        batch_op.drop_column("notify_group")


def downgrade() -> None:
    with op.batch_alter_table("report_schedules") as batch_op:
        batch_op.add_column(
            sa.Column("notify_group", sa.Boolean(), nullable=False, server_default=sa.false()),
        )
    op.create_table(
        "platform_im_connect_configs",
        sa.Column("channel", sa.String(length=16), nullable=False),
        sa.Column("state", sa.String(length=16), nullable=False),
        sa.Column("delivery_mode", sa.String(length=32), nullable=False, server_default="corporate_app"),
        sa.Column("callback_domain", sa.String(length=255), nullable=True),
        sa.Column("corp_id", sa.String(length=128), nullable=True),
        sa.Column("agent_id", sa.String(length=64), nullable=True),
        sa.Column("app_key", sa.String(length=128), nullable=True),
        sa.Column("app_id", sa.String(length=128), nullable=True),
        sa.Column("secret_encrypted", sa.Text(), nullable=True),
        sa.Column("app_secret_encrypted", sa.Text(), nullable=True),
        sa.Column("webhook_url", sa.String(length=1024), nullable=True),
        sa.Column("webhook_secret_encrypted", sa.Text(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_by", sa.Uuid(), nullable=True),
        sa.ForeignKeyConstraint(["updated_by"], ["auth_users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("channel"),
    )
    op.create_table(
        "user_im_bindings",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("channel", sa.String(length=16), nullable=False),
        sa.Column("account_id", sa.String(length=128), nullable=False),
        sa.Column("source", sa.String(length=16), nullable=False, server_default="oauth"),
        sa.Column("token_encrypted", sa.Text(), nullable=True),
        sa.Column("token_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["auth_users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_user_im_bindings_user_id", "user_im_bindings", ["user_id"])
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
