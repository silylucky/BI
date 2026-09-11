"""dashboard_templates table + dashboard:template.manage permission

Revision ID: 0026
Revises: 0025
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from app.auth.permissions.catalog import PERMISSION_CATALOG
from app.auth.permissions.constants import permission_id_for_code

revision: str = "0026"
down_revision: Union[str, None] = "0025"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_PERMISSION = "dashboard:template.manage"
ROOT_ADMIN_ROLE_ID = "00000000-0000-0000-0000-0000000000ad"


def _sql_str(value: str | None) -> str:
    if value is None:
        return "NULL"
    return "'" + value.replace("'", "''") + "'"


def upgrade() -> None:
    op.create_table(
        "dashboard_templates",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("template_key", sa.String(length=128), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category_key", sa.String(length=64), nullable=False, server_default="general"),
        sa.Column("surface_kind", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="draft"),
        sa.Column("layout_json", sa.JSON(), nullable=False),
        sa.Column("thumbnail_ref", sa.String(length=512), nullable=True),
        sa.Column("source_dashboard_id", sa.Uuid(), nullable=True),
        sa.Column("visibility", sa.String(length=32), nullable=False, server_default="private"),
        sa.Column("owner_user_id", sa.Uuid(), nullable=True),
        sa.Column("org_scope", sa.String(length=128), nullable=True),
        sa.Column("content_revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("template_key", name="uq_dashboard_templates_template_key"),
    )
    op.create_index("ix_dashboard_templates_surface_kind", "dashboard_templates", ["surface_kind"])
    op.create_index("ix_dashboard_templates_status", "dashboard_templates", ["status"])
    op.create_index("ix_dashboard_templates_visibility", "dashboard_templates", ["visibility"])
    op.create_index("ix_dashboard_templates_owner_user_id", "dashboard_templates", ["owner_user_id"])

    definition = next(d for d in PERMISSION_CATALOG if d.code == NEW_PERMISSION)
    pid = permission_id_for_code(definition.code)
    op.execute(
        "INSERT INTO auth_permissions (id, code, name, domain, description) VALUES ("
        f"'{pid}', {_sql_str(definition.code)}, {_sql_str(definition.name)}, "
        f"{_sql_str(definition.domain)}, {_sql_str(definition.description)}"
        ") ON CONFLICT (id) DO NOTHING"
    )


def downgrade() -> None:
    pid = permission_id_for_code(NEW_PERMISSION)
    op.execute(f"DELETE FROM auth_role_permissions WHERE permission_id = '{pid}'")
    op.execute(f"DELETE FROM auth_permissions WHERE id = '{pid}'")
    op.drop_index("ix_dashboard_templates_owner_user_id", table_name="dashboard_templates")
    op.drop_index("ix_dashboard_templates_visibility", table_name="dashboard_templates")
    op.drop_index("ix_dashboard_templates_status", table_name="dashboard_templates")
    op.drop_index("ix_dashboard_templates_surface_kind", table_name="dashboard_templates")
    op.drop_table("dashboard_templates")
