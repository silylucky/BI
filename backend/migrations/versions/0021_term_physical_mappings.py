"""term physical field mappings

Revision ID: 0021
Revises: 0020
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from migrations.dialect_ops import now_server_default

revision: str = "0021"
down_revision: Union[str, None] = "0020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    now = now_server_default(op.get_bind())
    op.create_table(
        "term_physical_mappings",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "term_id",
            sa.Uuid(),
            sa.ForeignKey("glossary_terms.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("table_fqn", sa.String(128), nullable=False),
        sa.Column("column_name", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=now, nullable=False),
        sa.UniqueConstraint(
            "term_id",
            "table_fqn",
            "column_name",
            name="uq_term_physical_mapping",
        ),
    )
    op.create_index("ix_term_physical_mappings_term_id", "term_physical_mappings", ["term_id"])


def downgrade() -> None:
    op.drop_index("ix_term_physical_mappings_term_id", table_name="term_physical_mappings")
    op.drop_table("term_physical_mappings")
