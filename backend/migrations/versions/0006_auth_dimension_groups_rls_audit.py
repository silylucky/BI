"""auth dimension groups, role bindings, audit actor index

Revision ID: 0006
Revises: 0005
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from migrations.dialect_ops import now_server_default

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    now = now_server_default(bind)
    op.create_table(
        "auth_dimension_groups",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "dimension_type_id",
            sa.Uuid(),
            sa.ForeignKey("auth_dimension_types.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("code", sa.String(64), nullable=False),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column(
            "parent_id",
            sa.Uuid(),
            sa.ForeignKey("auth_dimension_groups.id", ondelete="RESTRICT"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=now, nullable=False),
        sa.UniqueConstraint("dimension_type_id", "code", name="uq_auth_dimension_groups_type_code"),
    )
    op.create_table(
        "auth_dimension_group_values",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "group_id",
            sa.Uuid(),
            sa.ForeignKey("auth_dimension_groups.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("value", sa.String(256), nullable=False),
        sa.UniqueConstraint("group_id", "value", name="uq_auth_dimension_group_values"),
    )
    op.create_table(
        "auth_role_dimension_values",
        sa.Column("role_id", sa.Uuid(), sa.ForeignKey("auth_roles.id", ondelete="CASCADE"), primary_key=True),
        sa.Column(
            "dimension_type_id",
            sa.Uuid(),
            sa.ForeignKey("auth_dimension_types.id", ondelete="RESTRICT"),
            primary_key=True,
        ),
        sa.Column("value", sa.String(256), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=now, nullable=False),
    )
    op.create_table(
        "auth_role_dimension_groups",
        sa.Column("role_id", sa.Uuid(), sa.ForeignKey("auth_roles.id", ondelete="CASCADE"), primary_key=True),
        sa.Column(
            "group_id",
            sa.Uuid(),
            sa.ForeignKey("auth_dimension_groups.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=now, nullable=False),
    )
    op.create_index(
        "ix_auth_audit_events_actor_created",
        "auth_audit_events",
        ["actor_id", sa.text("created_at DESC")],
    )


def downgrade() -> None:
    op.drop_index("ix_auth_audit_events_actor_created", table_name="auth_audit_events")
    op.drop_table("auth_role_dimension_groups")
    op.drop_table("auth_role_dimension_values")
    op.drop_table("auth_dimension_group_values")
    op.drop_table("auth_dimension_groups")
