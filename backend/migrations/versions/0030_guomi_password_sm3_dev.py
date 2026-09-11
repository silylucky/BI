"""国密应用层：纯 SM3 密码哈希（dev demo 用户重算）

Revision ID: 0030
Revises: 0029
"""

from __future__ import annotations

import os
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import context, op

revision: str = "0030"
down_revision: Union[str, None] = "0029"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_DEMO_USERS = ("admin", "analyst", "viewer")
_BCRYPT_PREFIXES = ("$2a$", "$2b$", "$2y$")


def _hash_sm3_for_migration(password: str) -> str:
    from gmssl import func, sm3

    salt = __import__("secrets").token_hex(16)
    digest = sm3.sm3_hash(func.bytes_to_list(f"{salt}{password}".encode()))
    return f"$sm3${salt}${digest}"


def upgrade() -> None:
    if context.is_offline_mode():
        return
    if os.environ.get("VITALSPAN_ENV", "development") != "development":
        return

    bind = op.get_bind()
    password = os.environ.get("VITALSPAN_DEV_ADMIN_PASSWORD", "changeme")
    sm3_hash = _hash_sm3_for_migration(password)

    for username in _DEMO_USERS:
        row = bind.execute(
            sa.text("SELECT id, password_hash FROM auth_users WHERE username = :u LIMIT 1"),
            {"u": username},
        ).first()
        if row is None:
            continue
        current_hash = row[1] or ""
        if current_hash.startswith("$sm3$"):
            continue
        if not any(current_hash.startswith(prefix) for prefix in _BCRYPT_PREFIXES):
            continue
        bind.execute(
            sa.text("UPDATE auth_users SET password_hash = :h WHERE id = :id"),
            {"h": sm3_hash, "id": str(row[0])},
        )


def downgrade() -> None:
    pass
