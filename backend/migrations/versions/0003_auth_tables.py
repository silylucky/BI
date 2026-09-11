"""auth tables

Revision ID: 0003
Revises: 0002
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from migrations.dialect_ops import bool_false_default, now_server_default, uuid_server_default

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _uuid_pk(bind):
    default = uuid_server_default(bind)
    kwargs: dict = {"primary_key": True}
    if default is not None:
        kwargs["server_default"] = default
    return sa.Column("id", sa.Uuid(), **kwargs)


def upgrade() -> None:
    bind = op.get_bind()
    now = now_server_default(bind)
    bool_false = bool_false_default(bind)

    op.create_table(
        "auth_roles",
        _uuid_pk(bind),
        sa.Column("code", sa.String(64), nullable=False, unique=True),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=now, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=now, nullable=False),
    )
    op.create_table(
        "auth_org_nodes",
        _uuid_pk(bind),
        sa.Column("parent_id", sa.Uuid(), sa.ForeignKey("auth_org_nodes.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("path", sa.String(512), nullable=False),
        sa.Column("level", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=now, nullable=False),
    )
    op.create_table(
        "auth_users",
        _uuid_pk(bind),
        sa.Column("username", sa.String(128), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=now, nullable=False),
    )
    op.create_table(
        "auth_user_roles",
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("auth_users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("role_id", sa.Uuid(), sa.ForeignKey("auth_roles.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=now, nullable=False),
        sa.UniqueConstraint("user_id", "role_id", name="uq_auth_user_roles"),
    )
    op.create_table(
        "auth_resource_grants",
        _uuid_pk(bind),
        sa.Column("role_id", sa.Uuid(), sa.ForeignKey("auth_roles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("resource_type", sa.String(32), nullable=False),
        sa.Column("resource_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=now, nullable=False),
        sa.UniqueConstraint("role_id", "resource_type", "resource_id", name="uq_auth_resource_grants"),
    )
    op.create_table(
        "auth_dimension_types",
        _uuid_pk(bind),
        sa.Column("code", sa.String(64), nullable=False, unique=True),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("value_type", sa.String(32), nullable=False),
        sa.Column("org_dimension", sa.Boolean(), server_default=bool_false, nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=now, nullable=False),
    )


def downgrade() -> None:
    op.drop_table("auth_dimension_types")
    op.drop_table("auth_resource_grants")
    op.drop_table("auth_user_roles")
    op.drop_table("auth_users")
    op.drop_table("auth_org_nodes")
    op.drop_table("auth_roles")
