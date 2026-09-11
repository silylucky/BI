"""Model-reviewer auth fixes: indexes, CHECK constraints, invalid mask cleanup.

Revision ID: 0061
Revises: 0060
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0061"
down_revision: Union[str, None] = "0060"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_RESOURCE_TYPE_CHECK = (
    "resource_type IN ('datasource', 'dashboard', 'report', 'gov_catalog_entry')"
)


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        op.execute(
            sa.text(
                "DELETE FROM auth_column_masks "
                "WHERE datasource_id IS NULL AND (dataset_id IS NULL OR dataset_id = '')"
            )
        )
    else:
        op.execute(
            sa.text(
                "DELETE FROM auth_column_masks "
                "WHERE datasource_id IS NULL AND dataset_id IS NULL"
            )
        )

    op.create_index("ix_auth_org_nodes_path", "auth_org_nodes", ["path"])
    op.create_index("ix_auth_user_roles_role_id", "auth_user_roles", ["role_id"])
    op.create_index(
        "ix_auth_audit_events_target_type_created",
        "auth_audit_events",
        ["target_type", "created_at"],
    )

    if bind.dialect.name == "sqlite":
        with op.batch_alter_table("auth_resource_grants") as batch_op:
            batch_op.create_check_constraint(
                "ck_auth_resource_grants_resource_type",
                _RESOURCE_TYPE_CHECK,
            )
        with op.batch_alter_table("auth_user_resource_grants") as batch_op:
            batch_op.create_check_constraint(
                "ck_auth_user_resource_grants_resource_type",
                _RESOURCE_TYPE_CHECK,
            )
        with op.batch_alter_table("user_im_bindings") as batch_op:
            batch_op.create_check_constraint(
                "ck_user_im_bindings_source",
                "source IN ('oauth', 'admin')",
            )
        return

    op.create_check_constraint(
        "ck_auth_resource_grants_resource_type",
        "auth_resource_grants",
        _RESOURCE_TYPE_CHECK,
    )
    op.create_check_constraint(
        "ck_auth_user_resource_grants_resource_type",
        "auth_user_resource_grants",
        _RESOURCE_TYPE_CHECK,
    )
    op.create_check_constraint(
        "ck_user_im_bindings_source",
        "user_im_bindings",
        "source IN ('oauth', 'admin')",
    )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        with op.batch_alter_table("user_im_bindings") as batch_op:
            batch_op.drop_constraint("ck_user_im_bindings_source", type_="check")
        with op.batch_alter_table("auth_user_resource_grants") as batch_op:
            batch_op.drop_constraint("ck_auth_user_resource_grants_resource_type", type_="check")
        with op.batch_alter_table("auth_resource_grants") as batch_op:
            batch_op.drop_constraint("ck_auth_resource_grants_resource_type", type_="check")
    else:
        op.drop_constraint("ck_user_im_bindings_source", "user_im_bindings", type_="check")
        op.drop_constraint(
            "ck_auth_user_resource_grants_resource_type",
            "auth_user_resource_grants",
            type_="check",
        )
        op.drop_constraint(
            "ck_auth_resource_grants_resource_type",
            "auth_resource_grants",
            type_="check",
        )

    op.drop_index("ix_auth_audit_events_target_type_created", table_name="auth_audit_events")
    op.drop_index("ix_auth_user_roles_role_id", table_name="auth_user_roles")
    op.drop_index("ix_auth_org_nodes_path", table_name="auth_org_nodes")
