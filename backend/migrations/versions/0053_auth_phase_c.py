"""Phase C: user overrides, column masks, new permissions

Revision ID: 0053
Revises: 0052
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from app.auth.permissions.catalog import PERMISSION_CATALOG
from app.auth.permissions.constants import permission_id_for_code
from migrations.dialect_ops import permission_upsert_statement

revision: str = "0053"
down_revision: Union[str, None] = "0052"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    for definition in PERMISSION_CATALOG:
        pid = permission_id_for_code(definition.code)
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

    op.create_table(
        "auth_user_resource_grants",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("resource_type", sa.String(length=32), nullable=False),
        sa.Column("resource_id", sa.Uuid(), nullable=False),
        sa.Column("effect", sa.String(length=8), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint("effect IN ('add', 'deny')", name="ck_auth_user_resource_grants_effect"),
        sa.ForeignKeyConstraint(["user_id"], ["auth_users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "resource_type",
            "resource_id",
            name="uq_auth_user_resource_grants",
        ),
    )
    op.create_index(
        "ix_auth_user_resource_grants_user",
        "auth_user_resource_grants",
        ["user_id"],
    )

    op.create_table(
        "auth_user_dimension_overrides",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("dimension_type_id", sa.Uuid(), nullable=False),
        sa.Column("value", sa.String(length=256), nullable=False),
        sa.Column("effect", sa.String(length=8), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "effect IN ('add', 'deny')", name="ck_auth_user_dimension_overrides_effect"
        ),
        sa.ForeignKeyConstraint(["user_id"], ["auth_users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["dimension_type_id"],
            ["auth_dimension_types.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("user_id", "dimension_type_id", "value"),
    )

    op.create_table(
        "auth_column_masks",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("datasource_id", sa.Uuid(), nullable=True),
        sa.Column("dataset_id", sa.String(length=64), nullable=True),
        sa.Column("table_name", sa.String(length=128), nullable=False),
        sa.Column("column_name", sa.String(length=64), nullable=False),
        sa.Column("mask_strategy", sa.String(length=16), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "mask_strategy IN ('hide', 'partial', 'hash')",
            name="ck_auth_column_masks_strategy",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "datasource_id",
            "dataset_id",
            "table_name",
            "column_name",
            name="uq_auth_column_masks_scope",
        ),
    )
    op.create_index("ix_auth_column_masks_datasource", "auth_column_masks", ["datasource_id"])
    op.create_index("ix_auth_column_masks_dataset", "auth_column_masks", ["dataset_id"])


def downgrade() -> None:
    op.drop_index("ix_auth_column_masks_dataset", table_name="auth_column_masks")
    op.drop_index("ix_auth_column_masks_datasource", table_name="auth_column_masks")
    op.drop_table("auth_column_masks")
    op.drop_table("auth_user_dimension_overrides")
    op.drop_index("ix_auth_user_resource_grants_user", table_name="auth_user_resource_grants")
    op.drop_table("auth_user_resource_grants")
    new_codes = ("system:org_scoped.manage", "dataset:mask.manage")
    ids = ", ".join(f"'{permission_id_for_code(code)}'" for code in new_codes)
    op.execute(f"DELETE FROM auth_role_permissions WHERE permission_id IN ({ids})")
    op.execute(f"DELETE FROM auth_permissions WHERE code IN ({', '.join(repr(c) for c in new_codes)})")
