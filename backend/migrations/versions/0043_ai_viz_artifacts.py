"""ai_viz_artifacts table for sandbox custom viz bundles

Revision ID: 0043
Revises: 0042
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0043"
down_revision: Union[str, None] = "0042"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ai_viz_artifacts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("manifest_json", sa.JSON(), nullable=False),
        sa.Column("files_json", sa.JSON(), nullable=False),
        sa.Column("content_hash", sa.String(length=64), nullable=False),
        sa.Column("owner_user_id", sa.Uuid(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="draft"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_viz_artifacts_owner_user_id", "ai_viz_artifacts", ["owner_user_id"])


def downgrade() -> None:
    op.drop_index("ix_ai_viz_artifacts_owner_user_id", table_name="ai_viz_artifacts")
    op.drop_table("ai_viz_artifacts")
