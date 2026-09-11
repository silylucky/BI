"""DingTalk group-robot webhook delivery (0062).

Revision ID: 0062
Revises: 0061
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0062"
down_revision: Union[str, None] = "0061"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_NEW = "delivery_mode IN ('corporate_app', 'user_delegated', 'group_webhook')"
_OLD = "delivery_mode IN ('corporate_app', 'user_delegated')"


def _recreate_delivery_mode_check(expression: str) -> None:
    bind = op.get_bind()
    with op.batch_alter_table("platform_im_connect_configs") as batch:
        try:
            batch.drop_constraint(
                "ck_platform_im_connect_configs_delivery_mode",
                type_="check",
            )
        except Exception as exc:
            dialect = bind.dialect.name
            message = str(exc).lower()
            missing = "does not exist" in message or "no such constraint" in message or "unknown constraint" in message
            if dialect == "sqlite" or missing:
                pass
            else:
                raise
        batch.create_check_constraint(
            "ck_platform_im_connect_configs_delivery_mode",
            expression,
        )


def upgrade() -> None:
    _recreate_delivery_mode_check(_NEW)


def downgrade() -> None:
    _recreate_delivery_mode_check(_OLD)
