"""view_user_overrides table for user default view persistence

Revision ID: 0038
Revises: 0037
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from migrations.dialect_ops import bool_false_default, now_server_default

revision: str = "0038"
down_revision: Union[str, None] = "0037"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    bool_false = bool_false_default(bind)
    now_default = now_server_default(bind)
    op.create_table(
        "view_user_overrides",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("dashboard_id", sa.Uuid(), nullable=False),
        sa.Column("layout_json", sa.JSON(), nullable=False),
        sa.Column("classification_scope", sa.String(length=32), nullable=True),
        sa.Column("inherited_from_role", sa.Boolean(), nullable=False, server_default=bool_false),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=bool_false),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=now_default,
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "name", name="uq_view_user_override_name"),
    )
    op.create_index("ix_view_user_overrides_user_id", "view_user_overrides", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_view_user_overrides_user_id", table_name="view_user_overrides")
    op.drop_table("view_user_overrides")
