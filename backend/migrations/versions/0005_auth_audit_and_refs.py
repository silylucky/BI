"""auth audit events and dimension type refs

Revision ID: 0005
Revises: 0004
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from migrations.dialect_ops import now_server_default

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    now = now_server_default(bind)
    op.create_table(
        "auth_audit_events",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("actor_id", sa.String(128), nullable=False),
        sa.Column("actor_username", sa.String(128), nullable=True),
        sa.Column("target_type", sa.String(32), nullable=False),
        sa.Column("target_id", sa.Uuid(), nullable=False),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("trace_id", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=now, nullable=False),
    )
    op.create_index(
        "ix_auth_audit_events_target_created",
        "auth_audit_events",
        ["target_id", sa.text("created_at DESC")],
    )
    op.create_index(
        "ix_auth_audit_events_action_created",
        "auth_audit_events",
        ["action", sa.text("created_at DESC")],
    )
    op.create_table(
        "auth_dimension_type_refs",
        sa.Column(
            "dimension_type_id",
            sa.Uuid(),
            sa.ForeignKey("auth_dimension_types.id", ondelete="RESTRICT"),
            primary_key=True,
        ),
        sa.Column("ref_source", sa.String(32), server_default="group", nullable=False),
    )


def downgrade() -> None:
    op.drop_table("auth_dimension_type_refs")
    op.drop_index("ix_auth_audit_events_action_created", table_name="auth_audit_events")
    op.drop_index("ix_auth_audit_events_target_created", table_name="auth_audit_events")
    op.drop_table("auth_audit_events")
