"""Revision ID: 0052
Revises: 0051
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0052"
down_revision: Union[str, None] = "0051"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "auth_rls_column_bindings",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("datasource_id", sa.Uuid(), nullable=True),
        sa.Column("dataset_id", sa.String(length=64), nullable=True),
        sa.Column("table_name", sa.String(length=128), nullable=False),
        sa.Column("dimension_type_id", sa.Uuid(), nullable=False),
        sa.Column("column_name", sa.String(length=64), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["dimension_type_id"],
            ["auth_dimension_types.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "datasource_id",
            "dataset_id",
            "table_name",
            "dimension_type_id",
            name="uq_auth_rls_column_bindings_scope",
        ),
    )
    op.create_index(
        "ix_auth_rls_column_bindings_datasource",
        "auth_rls_column_bindings",
        ["datasource_id"],
    )
    op.create_index(
        "ix_auth_rls_column_bindings_dataset",
        "auth_rls_column_bindings",
        ["dataset_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_auth_rls_column_bindings_dataset", table_name="auth_rls_column_bindings")
    op.drop_index("ix_auth_rls_column_bindings_datasource", table_name="auth_rls_column_bindings")
    op.drop_table("auth_rls_column_bindings")
