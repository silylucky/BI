"""dev demo roles and users for RBAC switcher

Revision ID: 0018
Revises: 0017
"""

from __future__ import annotations

import os
import uuid
from typing import Sequence, Union

import bcrypt
import sqlalchemy as sa
from alembic import context, op

revision: str = "0018"
down_revision: Union[str, None] = "0017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_DEMO_ROLES: tuple[tuple[str, str], ...] = (
    ("admin", "管理员"),
    ("analyst", "分析师"),
    ("viewer", "查看者"),
)

_DEMO_USERS: tuple[tuple[str, str], ...] = (
    ("admin", "admin"),
    ("analyst", "analyst"),
    ("viewer", "viewer"),
)


def _ensure_role(bind, code: str, name: str) -> str:
    row = bind.execute(
        sa.text("SELECT id FROM auth_roles WHERE code = :code LIMIT 1"),
        {"code": code},
    ).first()
    if row:
        return str(row[0])
    role_id = uuid.uuid4()
    bind.execute(
        sa.text(
            "INSERT INTO auth_roles (id, code, name, is_active) "
            "VALUES (:id, :code, :name, true)"
        ),
        {"id": str(role_id), "code": code, "name": name},
    )
    return str(role_id)


def _ensure_user(bind, username: str, password_hash: str) -> str:
    row = bind.execute(
        sa.text("SELECT id FROM auth_users WHERE username = :u LIMIT 1"),
        {"u": username},
    ).first()
    if row:
        bind.execute(
            sa.text("UPDATE auth_users SET password_hash = :h WHERE username = :u"),
            {"h": password_hash, "u": username},
        )
        return str(row[0])
    user_id = uuid.uuid4()
    bind.execute(
        sa.text(
            "INSERT INTO auth_users (id, username, password_hash) VALUES (:id, :u, :h)"
        ),
        {"id": str(user_id), "u": username, "h": password_hash},
    )
    return str(user_id)


def _bind_role(bind, user_id: str, role_id: str) -> None:
    sql = (
        "INSERT INTO auth_user_roles (user_id, role_id) VALUES (:uid, :rid)"
    )
    from migrations.dialect_ops import insert_ignore_statement

    bind.execute(
        sa.text(insert_ignore_statement(bind, sql)),
        {"uid": user_id, "rid": role_id},
    )


def upgrade() -> None:
    if context.is_offline_mode():
        return
    env = os.environ.get("VITALSPAN_ENV", "development")
    if env != "development":
        return

    bind = op.get_bind()
    password = os.environ.get("VITALSPAN_DEV_ADMIN_PASSWORD", "changeme")
    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    role_ids: dict[str, str] = {}
    for code, name in _DEMO_ROLES:
        role_ids[code] = _ensure_role(bind, code, name)

    for username, role_code in _DEMO_USERS:
        user_id = _ensure_user(bind, username, hashed)
        _bind_role(bind, user_id, role_ids[role_code])


def downgrade() -> None:
    if context.is_offline_mode():
        return
    bind = op.get_bind()
    for username, _ in _DEMO_USERS:
        if username == "admin":
            continue
        bind.execute(
            sa.text("DELETE FROM auth_users WHERE username = :u"),
            {"u": username},
        )
