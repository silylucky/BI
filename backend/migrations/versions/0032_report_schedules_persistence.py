"""report schedules + export persistence

Revision ID: 0032
Revises: 0031
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from app.auth.permissions.catalog import PERMISSION_CATALOG
from app.auth.permissions.constants import permission_id_for_code
from migrations.dialect_ops import permission_upsert_statement, role_permission_mapping_statement

revision: str = "0032"
down_revision: Union[str, None] = "0031"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_PERMISSION = "dashboard:schedule"


def upgrade() -> None:
    op.create_table(
        "report_schedules",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=True),
        sa.Column("catalog_node_id", sa.Uuid(), nullable=True),
        sa.Column("source_type", sa.String(length=32), nullable=False, server_default="template"),
        sa.Column("source_id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.String(length=64), nullable=True),
        sa.Column("recipients", sa.JSON(), nullable=False),
        sa.Column("attachment_formats", sa.JSON(), nullable=False),
        sa.Column("delivery_channels", sa.JSON(), nullable=False),
        sa.Column("cron", sa.String(length=64), nullable=False),
        sa.Column("timezone", sa.String(length=64), nullable=False, server_default="Asia/Shanghai"),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="draft"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_report_schedules_source_id", "report_schedules", ["source_id"])
    op.create_index("ix_report_schedules_status", "report_schedules", ["status"])

    op.create_table(
        "report_schedule_executions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("schedule_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(length=64), nullable=False),
        sa.Column("artifact_ref", sa.Text(), nullable=False),
        sa.Column("artifact_kind", sa.String(length=64), nullable=True),
        sa.Column("artifact_storage_key", sa.String(length=512), nullable=True),
        sa.Column("secondary_artifacts", sa.JSON(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("delivery_steps", sa.JSON(), nullable=True),
        sa.Column("idempotency_key", sa.String(length=128), nullable=True),
        sa.Column("parent_execution_id", sa.Uuid(), nullable=True),
        sa.Column("revision_snapshot", sa.JSON(), nullable=True),
        sa.Column("executed_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_report_schedule_executions_schedule_id", "report_schedule_executions", ["schedule_id"])

    op.create_table(
        "dashboard_export_jobs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("dashboard_id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.String(length=64), nullable=False),
        sa.Column("fmt", sa.String(length=16), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="ready"),
        sa.Column("artifact_kind", sa.String(length=64), nullable=True),
        sa.Column("storage_key", sa.String(length=512), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "export_tokens",
        sa.Column("token", sa.String(length=128), nullable=False),
        sa.Column("dashboard_id", sa.Uuid(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.PrimaryKeyConstraint("token"),
    )

    op.create_table(
        "report_schedule_tick_locks",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("schedule_id", sa.Uuid(), nullable=False),
        sa.Column("tick_key", sa.String(length=64), nullable=False),
        sa.Column("acquired_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tick_key"),
    )

    definition = next(d for d in PERMISSION_CATALOG if d.code == NEW_PERMISSION)
    pid = permission_id_for_code(NEW_PERMISSION)
    bind = op.get_bind()
    op.execute(
        permission_upsert_statement(
            bind,
            pid=str(pid),
            code=definition.code,
            name=definition.name,
            domain=definition.domain,
            description=definition.description,
        )
    )
    for role_code in ("admin", "analyst", "editor", "owner"):
        op.execute(role_permission_mapping_statement(bind, role_code=role_code, permission_codes=(NEW_PERMISSION,)))


def downgrade() -> None:
    pid = permission_id_for_code(NEW_PERMISSION)
    op.execute(f"DELETE FROM auth_role_permissions WHERE permission_id = '{pid}'")
    op.execute(f"DELETE FROM auth_permissions WHERE id = '{pid}'")
    op.drop_table("report_schedule_tick_locks")
    op.drop_table("export_tokens")
    op.drop_table("dashboard_export_jobs")
    op.drop_table("report_schedule_executions")
    op.drop_index("ix_report_schedules_status", table_name="report_schedules")
    op.drop_index("ix_report_schedules_source_id", table_name="report_schedules")
    op.drop_table("report_schedules")
