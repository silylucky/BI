"""purge legacy word report catalog nodes

Revision ID: 0054
Revises: 0053
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0054"
down_revision: Union[str, None] = "0053"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    from app.reports.catalog.legacy_cleanup import purge_legacy_word_template_nodes

    purge_legacy_word_template_nodes()


def downgrade() -> None:
    # Legacy word templates are intentionally not restored.
    pass
