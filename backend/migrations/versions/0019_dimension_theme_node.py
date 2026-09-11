"""dimension theme_node_id FK

Revision ID: 0019
Revises: 0018
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0019"
down_revision: Union[str, None] = "0018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    column = sa.Column(
        "theme_node_id",
        sa.Uuid(),
        sa.ForeignKey("theme_nodes.id", ondelete="SET NULL", name="fk_dimension_dicts_theme_node_id"),
        nullable=True,
    )
    if bind.dialect.name == "sqlite":
        with op.batch_alter_table("dimension_dicts") as batch_op:
            batch_op.add_column(column)
            batch_op.create_index("ix_dimension_dicts_theme_node_id", ["theme_node_id"])
        return

    op.add_column("dimension_dicts", column)
    op.create_index("ix_dimension_dicts_theme_node_id", "dimension_dicts", ["theme_node_id"])


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        with op.batch_alter_table("dimension_dicts") as batch_op:
            batch_op.drop_index("ix_dimension_dicts_theme_node_id")
            batch_op.drop_column("theme_node_id")
        return

    op.drop_index("ix_dimension_dicts_theme_node_id", table_name="dimension_dicts")
    op.drop_column("dimension_dicts", "theme_node_id")
