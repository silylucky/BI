"""data_sources connection_options and active code uniqueness

Revision ID: 0010
Revises: 0009
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from migrations.dialect_ops import create_active_code_unique_index, drop_active_code_unique_index

revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "data_sources",
        sa.Column("connection_options", sa.JSON(), nullable=True),
    )
    with op.batch_alter_table("data_sources") as batch_op:
        batch_op.drop_constraint("data_sources_code_key", type_="unique")
    bind = op.get_bind()
    create_active_code_unique_index(bind)


def downgrade() -> None:
    bind = op.get_bind()
    drop_active_code_unique_index(bind)
    with op.batch_alter_table("data_sources") as batch_op:
        batch_op.create_unique_constraint("data_sources_code_key", ["code"])
    op.drop_column("data_sources", "connection_options")
