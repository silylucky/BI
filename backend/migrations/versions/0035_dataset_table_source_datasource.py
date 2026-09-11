"""dataset table picker datasource persistence

Revision ID: 0035
Revises: 0034
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0035"
down_revision: Union[str, None] = "0034"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("datasets", sa.Column("table_source_datasource_id", sa.Uuid(), nullable=True))


def downgrade() -> None:
    op.drop_column("datasets", "table_source_datasource_id")
