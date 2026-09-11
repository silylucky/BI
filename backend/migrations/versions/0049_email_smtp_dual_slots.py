"""email SMTP dual slots (qq + 163) + schedule email_smtp_slot

Revision ID: 0049
Revises: 0048
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0049"
down_revision: str | None = "0048"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "UPDATE platform_delivery_configs SET channel = 'email_qq' WHERE channel = 'email'",
    )
    with op.batch_alter_table("platform_delivery_configs") as batch:
        batch.drop_constraint("ck_platform_delivery_configs_channel", type_="check")
        batch.create_check_constraint(
            "ck_platform_delivery_configs_channel",
            "channel IN ('email_qq', 'email_163')",
        )
    with op.batch_alter_table("report_schedules") as batch:
        batch.add_column(
            sa.Column("email_smtp_slot", sa.String(length=8), nullable=False, server_default="qq"),
        )
        batch.create_check_constraint(
            "ck_report_schedules_email_smtp_slot",
            "email_smtp_slot IN ('qq', '163')",
        )


def downgrade() -> None:
    with op.batch_alter_table("report_schedules") as batch:
        batch.drop_constraint("ck_report_schedules_email_smtp_slot", type_="check")
        batch.drop_column("email_smtp_slot")
    with op.batch_alter_table("platform_delivery_configs") as batch:
        batch.drop_constraint("ck_platform_delivery_configs_channel", type_="check")
        batch.create_check_constraint("ck_platform_delivery_configs_channel", "channel IN ('email')")
    op.execute(
        "UPDATE platform_delivery_configs SET channel = 'email' WHERE channel = 'email_qq'",
    )
    op.execute("DELETE FROM platform_delivery_configs WHERE channel = 'email_163'")
