"""user_im_bindings + report_schedules.notify_group

Revision ID: 0047
Revises: 0046
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0047"
down_revision: Union[str, None] = "0046"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_im_bindings",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("channel", sa.String(length=16), nullable=False),
        sa.Column("account_id", sa.String(length=128), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["auth_users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "channel", name="uq_user_im_bindings_user_channel"),
        sa.CheckConstraint(
            "channel IN ('dingtalk', 'wecom', 'feishu')",
            name="ck_user_im_bindings_channel",
        ),
    )
    op.create_index("ix_user_im_bindings_user_id", "user_im_bindings", ["user_id"])
    with op.batch_alter_table("report_schedules", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "notify_group",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            ),
        )


def downgrade() -> None:
    with op.batch_alter_table("report_schedules", schema=None) as batch_op:
        batch_op.drop_column("notify_group")
    op.drop_index("ix_user_im_bindings_user_id", table_name="user_im_bindings")
    op.drop_table("user_im_bindings")
