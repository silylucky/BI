"""Normalize legacy hyphenated UUID values in SQLite meta databases.

Revision ID: 0066
Revises: 0065
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import context, op

revision: str = "0066"
down_revision: str | None = "0065"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _quote(identifier: str) -> str:
    return f'"{identifier.replace(chr(34), chr(34) * 2)}"'


def upgrade() -> None:
    if context.is_offline_mode():
        return
    bind = op.get_bind()
    if bind.dialect.name != "sqlite":
        return
    # A previously interrupted local upgrade can leave a compact UUID duplicate beside
    # its legacy hyphenated counterpart. Keep one logical user-role binding first.
    bind.exec_driver_sql(
        "DELETE FROM auth_user_roles WHERE rowid NOT IN ("
        "SELECT MIN(rowid) FROM auth_user_roles "
        "GROUP BY REPLACE(user_id, '-', ''), REPLACE(role_id, '-', '')"
        ")"
    )
    tables = bind.exec_driver_sql(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
    ).scalars()
    for table in tables:
        columns = bind.exec_driver_sql(f"PRAGMA table_info({_quote(table)})").mappings()
        for column in columns:
            if str(column["type"]).upper() != "CHAR(32)":
                continue
            name = _quote(str(column["name"]))
            quoted_table = _quote(str(table))
            bind.exec_driver_sql(
                f"UPDATE {quoted_table} SET {name} = REPLACE({name}, '-', '') "
                f"WHERE LENGTH({name}) = 36"
            )


def downgrade() -> None:
    # The normalized compact representation is the SQLAlchemy SQLite UUID format.
    return None
