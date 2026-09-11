"""Alembic migration helpers for PostgreSQL, MySQL 8+, and SQLite."""

from __future__ import annotations

import json
from typing import Any

import sqlalchemy as sa
from alembic import op


def dialect_name(bind) -> str:
    return bind.dialect.name


def uuid_server_default(bind) -> sa.TextClause | None:
    name = dialect_name(bind)
    if name == "postgresql":
        return sa.text("gen_random_uuid()")
    if name == "mysql":
        return sa.text("(UUID())")
    return None


def now_server_default(bind) -> sa.TextClause:
    if dialect_name(bind) == "postgresql":
        return sa.text("now()")
    return sa.text("CURRENT_TIMESTAMP")


def bool_true_default(bind) -> sa.TextClause:
    if dialect_name(bind) == "mysql":
        return sa.text("1")
    return sa.text("true")


def bool_false_default(bind) -> sa.TextClause:
    if dialect_name(bind) == "mysql":
        return sa.text("0")
    return sa.text("false")


def json_empty_array_default(bind) -> sa.TextClause:
    if dialect_name(bind) == "mysql":
        return sa.text("(JSON_ARRAY())")
    return sa.text("'[]'")


def json_layout_default(bind) -> sa.TextClause:
    payload = json.dumps({"version": 1, "widgets": [], "globalFilters": []}, separators=(",", ":"))
    if dialect_name(bind) == "postgresql":
        escaped = payload.replace("'", "''")
        return sa.text(f"'{escaped}'::json")
    escaped = payload.replace("'", "''")
    return sa.text(f"'{escaped}'")


def create_active_code_unique_index(
    bind,
    *,
    table: str = "data_sources",
    code_col: str = "code",
    deleted_col: str = "deleted_at",
    index_name: str = "uq_data_sources_code_active",
) -> None:
    name = dialect_name(bind)
    if name == "postgresql":
        op.create_index(
            index_name,
            table,
            [code_col],
            unique=True,
            postgresql_where=sa.text(f"{deleted_col} IS NULL"),
        )
        return
    if name == "sqlite":
        op.execute(
            sa.text(
                f"CREATE UNIQUE INDEX {index_name} ON {table} ({code_col}) "
                f"WHERE {deleted_col} IS NULL"
            )
        )
        return
    if name == "mysql":
        generated_col = "code_active_key"
        op.execute(
            sa.text(
                f"ALTER TABLE {table} ADD COLUMN {generated_col} VARCHAR(64) "
                f"GENERATED ALWAYS AS (IF({deleted_col} IS NULL, {code_col}, NULL)) STORED"
            )
        )
        op.create_index(index_name, table, [generated_col], unique=True)
        return
    raise ValueError(f"unsupported dialect for active code unique index: {name}")


def drop_active_code_unique_index(
    bind,
    *,
    table: str = "data_sources",
    index_name: str = "uq_data_sources_code_active",
    generated_col: str = "code_active_key",
) -> None:
    name = dialect_name(bind)
    if name == "postgresql":
        op.drop_index(index_name, table_name=table)
        return
    if name == "sqlite":
        op.execute(sa.text(f"DROP INDEX IF EXISTS {index_name}"))
        return
    if name == "mysql":
        op.drop_index(index_name, table_name=table)
        op.drop_column(table, generated_col)
        return
    raise ValueError(f"unsupported dialect for active code unique index: {name}")


def insert_ignore_suffix(bind) -> str:
    if dialect_name(bind) == "postgresql":
        return " ON CONFLICT DO NOTHING"
    return ""


def insert_ignore_statement(bind, insert_sql: str) -> str:
    name = dialect_name(bind)
    if name == "postgresql":
        return f"{insert_sql}{insert_ignore_suffix(bind)}"
    if name == "mysql":
        return insert_sql.replace("INSERT INTO", "INSERT IGNORE INTO", 1)
    return insert_sql.replace("INSERT INTO", "INSERT OR IGNORE INTO", 1)


def _sql_str(value: str | None) -> str:
    if value is None:
        return "NULL"
    return "'" + value.replace("'", "''") + "'"


def permission_upsert_statement(
    bind,
    *,
    pid: str,
    code: str,
    name: str,
    domain: str,
    description: str | None,
) -> str:
    base = (
        "INSERT INTO auth_permissions (id, code, name, domain, description) VALUES ("
        f"{_sql_str(pid)}, {_sql_str(code)}, {_sql_str(name)}, "
        f"{_sql_str(domain)}, {_sql_str(description)})"
    )
    name_d = dialect_name(bind)
    if name_d == "postgresql":
        return f"{base} ON CONFLICT (id) DO NOTHING"
    if name_d == "mysql":
        return f"{base} ON DUPLICATE KEY UPDATE id=id"
    return insert_ignore_statement(bind, base)


def admin_role_upsert_statement(bind) -> str:
    root_id = "00000000-0000-0000-0000-0000000000ad"
    name_d = dialect_name(bind)
    if name_d == "mysql":
        values = (
            f"('{root_id}', 'admin', '管理员', 1, 1, 1, 0, 0)"
        )
        update = "is_system = 1, is_root = 1"
        suffix = f" ON DUPLICATE KEY UPDATE {update}"
    elif name_d == "sqlite":
        values = (
            f"('{root_id}', 'admin', '管理员', 1, 1, 1, 0, 0)"
        )
        suffix = " ON CONFLICT (code) DO UPDATE SET is_system = 1, is_root = 1"
    else:
        values = (
            f"('{root_id}', 'admin', '管理员', true, true, true, 0, 0)"
        )
        suffix = " ON CONFLICT (code) DO UPDATE SET is_system = true, is_root = true"
    return (
        "INSERT INTO auth_roles "
        "(id, code, name, is_active, is_system, is_root, permission_version, rls_version) "
        f"VALUES {values}{suffix}"
    )


def role_permission_mapping_statement(bind, *, role_code: str, permission_codes: tuple[str, ...]) -> str:
    code_list = ", ".join(_sql_str(code) for code in permission_codes)
    base = (
        "INSERT INTO auth_role_permissions (role_id, permission_id) "
        "SELECT r.id, p.id FROM auth_roles r "
        f"JOIN auth_permissions p ON p.code IN ({code_list}) "
        f"WHERE r.code = {_sql_str(role_code)}"
    )
    return insert_ignore_statement(bind, base)


def uuid_column(bind, **kwargs: Any) -> sa.Column:
    default = uuid_server_default(bind)
    if default is not None:
        kwargs.setdefault("server_default", default)
    return sa.Column("id", sa.Uuid(), primary_key=True, **kwargs)
