"""Drop WeCom IM channel (0063).

Revision ID: 0063
Revises: 0062
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0063"
down_revision: Union[str, None] = "0062"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_NEW = "channel IN ('dingtalk', 'feishu')"
_OLD = "channel IN ('dingtalk', 'wecom', 'feishu')"


def _recreate_channel_check(table: str, name: str, expression: str) -> None:
    bind = op.get_bind()
    with op.batch_alter_table(table) as batch:
        try:
            batch.drop_constraint(name, type_="check")
        except Exception as exc:
            dialect = bind.dialect.name
            message = str(exc).lower()
            missing = "does not exist" in message or "no such constraint" in message or "unknown constraint" in message
            if dialect == "sqlite" or missing:
                pass
            else:
                raise
        batch.create_check_constraint(name, expression)


def upgrade() -> None:
    op.execute("DELETE FROM user_im_bindings WHERE channel = 'wecom'")
    op.execute("DELETE FROM platform_im_connect_configs WHERE channel = 'wecom'")
    op.execute("DELETE FROM im_oauth_states WHERE channel = 'wecom'")
    _recreate_channel_check("platform_im_connect_configs", "ck_platform_im_connect_configs_channel", _NEW)
    _recreate_channel_check("user_im_bindings", "ck_user_im_bindings_channel", _NEW)


def downgrade() -> None:
    _recreate_channel_check("platform_im_connect_configs", "ck_platform_im_connect_configs_channel", _OLD)
    _recreate_channel_check("user_im_bindings", "ck_user_im_bindings_channel", _OLD)
