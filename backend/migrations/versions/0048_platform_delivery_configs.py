"""platform_delivery_configs + platform_connect permissions

Revision ID: 0048
Revises: 0047
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from app.auth.permissions.catalog import PERMISSION_CATALOG
from app.auth.permissions.constants import permission_id_for_code
from migrations.dialect_ops import permission_upsert_statement, role_permission_mapping_statement

revision: str = "0048"
down_revision: Union[str, None] = "0047"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_PERMISSIONS = (
    "system:platform_connect.read",
    "system:platform_connect.manage",
)


def upgrade() -> None:
    op.create_table(
        "platform_delivery_configs",
        sa.Column("channel", sa.String(length=16), nullable=False),
        sa.Column("state", sa.String(length=16), nullable=False),
        sa.Column("host", sa.String(length=255), nullable=True),
        sa.Column("port", sa.Integer(), nullable=True),
        sa.Column("from_addr", sa.String(length=255), nullable=True),
        sa.Column("username", sa.String(length=255), nullable=True),
        sa.Column("password_encrypted", sa.Text(), nullable=True),
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
            name="ck_platform_delivery_configs_state",
        ),
        sa.CheckConstraint(
            "channel IN ('email')",
            name="ck_platform_delivery_configs_channel",
        ),
    )
    bind = op.get_bind()
    for code in NEW_PERMISSIONS:
        definition = next(d for d in PERMISSION_CATALOG if d.code == code)
        pid = permission_id_for_code(code)
        op.execute(
            permission_upsert_statement(
                bind,
                pid=str(pid),
                code=definition.code,
                name=definition.name,
                domain=definition.domain,
                description=definition.description,
            )
        )
    for code in NEW_PERMISSIONS:
        op.execute(role_permission_mapping_statement(bind, role_code="admin", permission_codes=(code,)))


def downgrade() -> None:
    for code in NEW_PERMISSIONS:
        pid = permission_id_for_code(code)
        op.execute(f"DELETE FROM auth_role_permissions WHERE permission_id = '{pid}'")
        op.execute(f"DELETE FROM auth_permissions WHERE id = '{pid}'")
    op.drop_table("platform_delivery_configs")
