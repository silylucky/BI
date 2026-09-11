"""standard analysis pack: dataset binding + snapshot retention

Revision ID: 0050
Revises: 0049
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0050"
down_revision: Union[str, None] = "0049"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("report_analysis_packs") as batch:
        batch.add_column(sa.Column("dataset_id", sa.String(length=64), nullable=True))
        batch.add_column(sa.Column("bound_config_id", sa.Uuid(), nullable=True))
        batch.add_column(
            sa.Column(
                "snapshot_retention_periods",
                sa.Integer(),
                nullable=False,
                server_default="12",
            )
        )
        batch.alter_column("business_object_code", existing_type=sa.String(length=64), nullable=True)
        batch.alter_column("physical_table_fqn", existing_type=sa.String(length=128), nullable=True)


def downgrade() -> None:
    with op.batch_alter_table("report_analysis_packs") as batch:
        batch.alter_column("physical_table_fqn", existing_type=sa.String(length=128), nullable=False)
        batch.alter_column("business_object_code", existing_type=sa.String(length=64), nullable=False)
        batch.drop_column("snapshot_retention_periods")
        batch.drop_column("bound_config_id")
        batch.drop_column("dataset_id")
