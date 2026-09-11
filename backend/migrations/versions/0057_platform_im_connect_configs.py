"""platform_im_connect_configs for IM app credentials

Revision ID: 0057
Revises: 0056
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0057"
down_revision: Union[str, None] = "0056"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "platform_im_connect_configs",
        sa.Column("channel", sa.String(length=16), nullable=False),
        sa.Column("state", sa.String(length=16), nullable=False),
        sa.Column("callback_domain", sa.String(length=255), nullable=True),
        sa.Column("credentials_encrypted", sa.Text(), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("updated_by", sa.Uuid(), nullable=True),
        sa.ForeignKeyConstraint(["updated_by"], ["auth_users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("channel"),
        sa.CheckConstraint(
            "state IN ('active', 'cleared')",
            name="ck_platform_im_connect_configs_state",
        ),
        sa.CheckConstraint(
            "channel IN ('dingtalk', 'wecom', 'feishu')",
            name="ck_platform_im_connect_configs_channel",
        ),
    )


def downgrade() -> None:
    op.drop_table("platform_im_connect_configs")
