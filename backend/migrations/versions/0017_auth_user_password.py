"""auth user password_hash + dev admin seed

Revision ID: 0017
Revises: 0016
"""

from __future__ import annotations

import os
import uuid
from typing import Sequence, Union

import bcrypt
import sqlalchemy as sa
from alembic import context, op

revision: str = "0017"
down_revision: Union[str, None] = "0016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "auth_users",
        sa.Column("password_hash", sa.String(255), nullable=False, server_default=""),
    )
    if context.is_offline_mode():
        return
    bind = op.get_bind()
    env = os.environ.get("VITALSPAN_ENV", "development")
    if env != "development":
        return
    password = os.environ.get("VITALSPAN_DEV_ADMIN_PASSWORD", "changeme")
    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    admin = bind.execute(
        sa.text("SELECT id FROM auth_users WHERE username = :u LIMIT 1"),
        {"u": "admin"},
    ).first()
    if admin:
        bind.execute(
            sa.text("UPDATE auth_users SET password_hash = :h WHERE username = 'admin'"),
            {"h": hashed},
        )
    else:
        user_id = uuid.uuid4()
        bind.execute(
            sa.text(
                "INSERT INTO auth_users (id, username, password_hash) VALUES (:id, 'admin', :h)"
            ),
            {"id": str(user_id), "h": hashed},
        )
        role = bind.execute(
            sa.text("SELECT id FROM auth_roles WHERE code = 'admin' LIMIT 1")
        ).first()
        if role:
            from migrations.dialect_ops import insert_ignore_statement

            bind.execute(
                sa.text(
                    insert_ignore_statement(
                        bind,
                        "INSERT INTO auth_user_roles (user_id, role_id) VALUES (:uid, :rid)",
                    )
                ),
                {"uid": str(user_id), "rid": str(role[0])},
            )


def downgrade() -> None:
    op.drop_column("auth_users", "password_hash")
