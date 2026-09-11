"""migrate standard analysis packs from physical table to dataset binding

Revision ID: 0055
Revises: 0054
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0055"
down_revision: Union[str, None] = "0054"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    from app.reports.standard.legacy_cleanup import migrate_physical_packs_to_dataset

    migrate_physical_packs_to_dataset()


def downgrade() -> None:
    pass
