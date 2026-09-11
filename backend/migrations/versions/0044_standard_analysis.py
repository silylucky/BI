"""drop prefab bindings; add standard analysis packs and snapshots

Revision ID: 0044
Revises: 0043
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0044"
down_revision: Union[str, None] = "0043"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_table("report_prefab_bindings")
    op.create_table(
        "report_analysis_packs",
        sa.Column("pack_key", sa.String(length=64), nullable=False),
        sa.Column("display_name", sa.String(length=120), nullable=False),
        sa.Column("business_object_code", sa.String(length=64), nullable=False),
        sa.Column("physical_table_fqn", sa.String(length=128), nullable=False),
        sa.Column("data_source_id", sa.Uuid(), nullable=False),
        sa.Column("field_mapping", sa.JSON(), nullable=False),
        sa.Column("enabled_themes", sa.JSON(), nullable=False),
        sa.Column("allowed_roles", sa.JSON(), nullable=False),
        sa.Column("snapshot_cron_preset", sa.String(length=16), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("pack_key"),
    )
    op.create_table(
        "report_analysis_snapshots",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("pack_key", sa.String(length=64), nullable=False),
        sa.Column("theme", sa.String(length=32), nullable=False),
        sa.Column("period_kind", sa.String(length=16), nullable=False),
        sa.Column("period_key", sa.String(length=32), nullable=False),
        sa.Column("filters_hash", sa.String(length=64), nullable=False, server_default="none"),
        sa.Column("captured_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "pack_key",
            "theme",
            "period_kind",
            "period_key",
            "filters_hash",
            name="uq_report_analysis_snapshot_dim",
        ),
    )
    op.create_index(
        "ix_report_analysis_snapshots_pack_key",
        "report_analysis_snapshots",
        ["pack_key"],
    )


def downgrade() -> None:
    op.drop_index("ix_report_analysis_snapshots_pack_key", table_name="report_analysis_snapshots")
    op.drop_table("report_analysis_snapshots")
    op.drop_table("report_analysis_packs")
    op.create_table(
        "report_prefab_bindings",
        sa.Column("binding_key", sa.String(length=64), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.PrimaryKeyConstraint("binding_key"),
    )
