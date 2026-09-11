"""chart_query_bindings for FR-2.0b direct chart query bindings

Revision ID: 0011
Revises: 0010
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0011"
down_revision: Union[str, None] = "0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "chart_query_bindings",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("data_source_id", sa.Uuid(), nullable=False),
        sa.Column("mode", sa.String(length=16), nullable=False),
        sa.Column("sql", sa.Text(), nullable=True),
        sa.Column("schema_name", sa.String(length=64), nullable=True),
        sa.Column("table_name", sa.String(length=64), nullable=True),
        sa.Column("default_limit", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_chart_query_bindings_data_source_id", "chart_query_bindings", ["data_source_id"])
    op.create_index("ix_chart_query_bindings_created_by", "chart_query_bindings", ["created_by"])


def downgrade() -> None:
    op.drop_index("ix_chart_query_bindings_created_by", table_name="chart_query_bindings")
    op.drop_index("ix_chart_query_bindings_data_source_id", table_name="chart_query_bindings")
    op.drop_table("chart_query_bindings")
