"""auth user org_node_id

Revision ID: 0004
Revises: 0003
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    column = sa.Column("org_node_id", sa.Uuid(), nullable=True)
    if bind.dialect.name == "sqlite":
        with op.batch_alter_table("auth_users") as batch_op:
            batch_op.add_column(column)
            batch_op.create_index("ix_auth_users_org_node_id", ["org_node_id"])
            batch_op.create_foreign_key(
                "fk_auth_users_org_node_id_auth_org_nodes",
                "auth_org_nodes",
                ["org_node_id"],
                ["id"],
                ondelete="SET NULL",
            )
        return

    op.add_column("auth_users", column)
    op.create_index("ix_auth_users_org_node_id", "auth_users", ["org_node_id"])
    op.create_foreign_key(
        "fk_auth_users_org_node_id_auth_org_nodes",
        "auth_users",
        "auth_org_nodes",
        ["org_node_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        with op.batch_alter_table("auth_users") as batch_op:
            batch_op.drop_constraint(
                "fk_auth_users_org_node_id_auth_org_nodes",
                type_="foreignkey",
            )
            batch_op.drop_index("ix_auth_users_org_node_id")
            batch_op.drop_column("org_node_id")
        return

    op.drop_constraint("fk_auth_users_org_node_id_auth_org_nodes", "auth_users", type_="foreignkey")
    op.drop_index("ix_auth_users_org_node_id", table_name="auth_users")
    op.drop_column("auth_users", "org_node_id")
