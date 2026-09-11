"""Add chart_id to chart_query_bindings

Revision ID: 0012
Revises: 0011
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0012"
down_revision: Union[str, None] = "0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("chart_query_bindings", sa.Column("chart_id", sa.Uuid(), nullable=True))
    op.create_index(
        "uq_chart_query_bindings_chart_id",
        "chart_query_bindings",
        ["chart_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_chart_query_bindings_chart_id", table_name="chart_query_bindings")
    op.drop_column("chart_query_bindings", "chart_id")
