"""report center final形态: jobs, favorites, recent, delivery audit, template versions

Revision ID: 0041
Revises: 0040
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0041"
down_revision: Union[str, None] = "0040"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "report_jobs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("job_kind", sa.String(length=32), nullable=False),
        sa.Column("owner_id", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("result_storage_key", sa.String(length=512), nullable=True),
        sa.Column("content_type", sa.String(length=128), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("lease_owner", sa.String(length=64), nullable=True),
        sa.Column("lease_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("poll_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_report_jobs_job_kind", "report_jobs", ["job_kind"])
    op.create_index("ix_report_jobs_owner_id", "report_jobs", ["owner_id"])
    op.create_index("ix_report_jobs_status", "report_jobs", ["status"])

    op.create_table(
        "report_user_favorites",
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("resource_type", sa.String(length=32), nullable=False),
        sa.Column("resource_id", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("user_id", "resource_type", "resource_id"),
    )

    op.create_table(
        "report_recent_views",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("resource_type", sa.String(length=32), nullable=False),
        sa.Column("resource_id", sa.String(length=64), nullable=False),
        sa.Column("resource_label", sa.String(length=255), nullable=True),
        sa.Column("viewed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_report_recent_views_user_id", "report_recent_views", ["user_id"])
    op.create_index("ix_report_recent_views_viewed_at", "report_recent_views", ["viewed_at"])

    op.create_table(
        "report_delivery_attempts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("execution_id", sa.Uuid(), nullable=False),
        sa.Column("channel", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("response_summary", sa.Text(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("attempted_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_report_delivery_attempts_execution_id", "report_delivery_attempts", ["execution_id"])

    op.create_table(
        "report_template_versions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("template_key", sa.String(length=64), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("change_note", sa.String(length=500), nullable=True),
        sa.Column("created_by", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_report_template_versions_template_key", "report_template_versions", ["template_key"])

    with op.batch_alter_table("report_template_definitions") as batch:
        batch.add_column(sa.Column("lifecycle", sa.String(length=16), nullable=False, server_default="draft"))
        batch.add_column(sa.Column("published_version", sa.Integer(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("report_template_definitions") as batch:
        batch.drop_column("published_version")
        batch.drop_column("lifecycle")

    op.drop_index("ix_report_template_versions_template_key", table_name="report_template_versions")
    op.drop_table("report_template_versions")
    op.drop_index("ix_report_delivery_attempts_execution_id", table_name="report_delivery_attempts")
    op.drop_table("report_delivery_attempts")
    op.drop_index("ix_report_recent_views_viewed_at", table_name="report_recent_views")
    op.drop_index("ix_report_recent_views_user_id", table_name="report_recent_views")
    op.drop_table("report_recent_views")
    op.drop_table("report_user_favorites")
    op.drop_index("ix_report_jobs_status", table_name="report_jobs")
    op.drop_index("ix_report_jobs_owner_id", table_name="report_jobs")
    op.drop_index("ix_report_jobs_job_kind", table_name="report_jobs")
    op.drop_table("report_jobs")
