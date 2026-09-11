"""auth role is_active + audit created_at index

Revision ID: 0007
Revises: 0006
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "auth_roles",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.create_index(
        "ix_auth_audit_events_created_at",
        "auth_audit_events",
        ["created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_auth_audit_events_created_at", table_name="auth_audit_events")
    op.drop_column("auth_roles", "is_active")
