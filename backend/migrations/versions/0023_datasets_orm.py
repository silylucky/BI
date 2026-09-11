"""datasets table for META-004 ORM persistence (FAKE-01)

Revision ID: 0023
Revises: 0022
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0023"
down_revision: Union[str, None] = "0022"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "datasets",
        sa.Column("dataset_id", sa.String(length=64), primary_key=True),
        sa.Column("display_name", sa.String(length=120), nullable=False),
        sa.Column("tables", sa.JSON(), nullable=False),
        sa.Column("computed_fields", sa.JSON(), nullable=False),
        sa.Column("allowed_roles", sa.JSON(), nullable=False),
        sa.Column("bound_config_id", sa.Uuid(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
    )
    op.create_index("ix_datasets_bound_config_id", "datasets", ["bound_config_id"])


def downgrade() -> None:
    op.drop_index("ix_datasets_bound_config_id", table_name="datasets")
    op.drop_table("datasets")
