"""Allow device/scan IM binding sources (0064).

Revision ID: 0064
Revises: 0063
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0064"
down_revision: Union[str, None] = "0063"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_NEW = "source IN ('oauth', 'admin', 'device', 'scan')"
_OLD = "source IN ('oauth', 'admin')"
_CONSTRAINT = "ck_user_im_bindings_source"


def _recreate_source_check(expression: str) -> None:
    bind = op.get_bind()
    with op.batch_alter_table("user_im_bindings") as batch:
        try:
            batch.drop_constraint(_CONSTRAINT, type_="check")
        except Exception as exc:
            dialect = bind.dialect.name
            message = str(exc).lower()
            missing = "does not exist" in message or "no such constraint" in message or "unknown constraint" in message
            if dialect == "sqlite" or missing:
                pass
            else:
                raise
        batch.create_check_constraint(_CONSTRAINT, expression)


def upgrade() -> None:
    _recreate_source_check(_NEW)


def downgrade() -> None:
    _recreate_source_check(_OLD)
