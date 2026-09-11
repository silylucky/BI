"""auth user display_name and email

Revision ID: 0020
Revises: 0019
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import context, op

revision: str = "0020"
down_revision: Union[str, None] = "0019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "auth_users",
        sa.Column("display_name", sa.String(128), nullable=True),
    )
    op.add_column(
        "auth_users",
        sa.Column("email", sa.String(255), nullable=True),
    )
    if context.is_offline_mode():
        return
    bind = op.get_bind()
    bind.execute(
        sa.text(
            "UPDATE auth_users SET display_name = username WHERE display_name IS NULL"
        )
    )
    if bind.dialect.name == "mysql":
        bind.execute(
            sa.text(
                "UPDATE auth_users SET email = CONCAT(username, '@vitalspan.local') "
                "WHERE email IS NULL"
            )
        )
    else:
        bind.execute(
            sa.text(
                "UPDATE auth_users SET email = username || '@vitalspan.local' WHERE email IS NULL"
            )
        )


def downgrade() -> None:
    op.drop_column("auth_users", "email")
    op.drop_column("auth_users", "display_name")
