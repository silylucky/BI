"""auth permission core: permissions, role_permissions, role/user security fields

Revision ID: 0024
Revises: 0023
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from migrations.dialect_ops import bool_false_default, bool_true_default, now_server_default, uuid_server_default

revision: str = "0024"
down_revision: Union[str, None] = "0023"
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
    bool_true = bool_true_default(bind)

    op.create_table(
        "auth_permissions",
        _uuid_pk(bind),
        sa.Column("code", sa.String(128), nullable=False, unique=True),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("domain", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=now, nullable=False),
    )
    op.create_index("ix_auth_permissions_domain", "auth_permissions", ["domain"])

    op.create_table(
        "auth_role_permissions",
        sa.Column(
            "role_id",
            sa.Uuid(),
            sa.ForeignKey("auth_roles.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "permission_id",
            sa.Uuid(),
            sa.ForeignKey("auth_permissions.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=now, nullable=False),
    )

    if bind.dialect.name == "sqlite":
        with op.batch_alter_table("auth_roles") as batch_op:
            batch_op.add_column(
                sa.Column("is_system", sa.Boolean(), nullable=False, server_default=bool_false),
            )
            batch_op.add_column(
                sa.Column("is_root", sa.Boolean(), nullable=False, server_default=bool_false),
            )
            batch_op.add_column(
                sa.Column("permission_version", sa.Integer(), nullable=False, server_default="0"),
            )
            batch_op.add_column(
                sa.Column("rls_version", sa.Integer(), nullable=False, server_default="0"),
            )
            batch_op.create_check_constraint(
                "ck_auth_roles_root_code",
                "NOT is_root OR code = 'admin'",
            )
        with op.batch_alter_table("auth_users") as batch_op:
            batch_op.add_column(
                sa.Column("is_active", sa.Boolean(), nullable=False, server_default=bool_true),
            )
            batch_op.add_column(
                sa.Column("failed_login_count", sa.Integer(), nullable=False, server_default="0"),
            )
            batch_op.add_column(sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True))
            batch_op.add_column(
                sa.Column("password_changed_at", sa.DateTime(timezone=True), nullable=True),
            )
            batch_op.add_column(
                sa.Column("token_version", sa.Integer(), nullable=False, server_default="1"),
            )
            batch_op.add_column(
                sa.Column("updated_at", sa.DateTime(timezone=True), server_default=now, nullable=False),
            )
        return

    op.add_column(
        "auth_roles",
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default=bool_false),
    )
    op.add_column(
        "auth_roles",
        sa.Column("is_root", sa.Boolean(), nullable=False, server_default=bool_false),
    )
    op.add_column(
        "auth_roles",
        sa.Column("permission_version", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "auth_roles",
        sa.Column("rls_version", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_check_constraint(
        "ck_auth_roles_root_code",
        "auth_roles",
        "NOT is_root OR code = 'admin'",
    )

    op.add_column(
        "auth_users",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=bool_true),
    )
    op.add_column(
        "auth_users",
        sa.Column("failed_login_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "auth_users",
        sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "auth_users",
        sa.Column("password_changed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "auth_users",
        sa.Column("token_version", sa.Integer(), nullable=False, server_default="1"),
    )
    op.add_column(
        "auth_users",
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=now, nullable=False),
    )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        with op.batch_alter_table("auth_users") as batch_op:
            batch_op.drop_column("updated_at")
            batch_op.drop_column("token_version")
            batch_op.drop_column("password_changed_at")
            batch_op.drop_column("locked_until")
            batch_op.drop_column("failed_login_count")
            batch_op.drop_column("is_active")
        with op.batch_alter_table("auth_roles") as batch_op:
            batch_op.drop_constraint("ck_auth_roles_root_code", type_="check")
            batch_op.drop_column("rls_version")
            batch_op.drop_column("permission_version")
            batch_op.drop_column("is_root")
            batch_op.drop_column("is_system")
    else:
        op.drop_column("auth_users", "updated_at")
        op.drop_column("auth_users", "token_version")
        op.drop_column("auth_users", "password_changed_at")
        op.drop_column("auth_users", "locked_until")
        op.drop_column("auth_users", "failed_login_count")
        op.drop_column("auth_users", "is_active")
        op.drop_constraint("ck_auth_roles_root_code", "auth_roles", type_="check")
        op.drop_column("auth_roles", "rls_version")
        op.drop_column("auth_roles", "permission_version")
        op.drop_column("auth_roles", "is_root")
        op.drop_column("auth_roles", "is_system")

    op.drop_table("auth_role_permissions")
    op.drop_index("ix_auth_permissions_domain", table_name="auth_permissions")
    op.drop_table("auth_permissions")
