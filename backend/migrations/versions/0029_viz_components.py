"""viz_components table + viz:component.manage permission

Revision ID: 0029
Revises: 0028
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from app.auth.permissions.catalog import PERMISSION_CATALOG
from app.auth.permissions.constants import permission_id_for_code

revision: str = "0029"
down_revision: Union[str, None] = "0028"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_PERMISSION = "viz:component.manage"


def _sql_str(value: str | None) -> str:
    if value is None:
        return "NULL"
    return "'" + value.replace("'", "''") + "'"


def upgrade() -> None:
    op.create_table(
        "viz_components",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("component_key", sa.String(length=128), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category_key", sa.String(length=64), nullable=False, server_default="general"),
        sa.Column("widget_type", sa.String(length=32), nullable=False),
        sa.Column("surface_kinds", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="draft"),
        sa.Column("payload_json", sa.JSON(), nullable=False),
        sa.Column("thumbnail_ref", sa.String(length=512), nullable=True),
        sa.Column("tags", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("visibility", sa.String(length=32), nullable=False, server_default="private"),
        sa.Column("owner_user_id", sa.Uuid(), nullable=True),
        sa.Column("org_scope", sa.String(length=128), nullable=True),
        sa.Column("content_revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("component_key", name="uq_viz_components_component_key"),
    )
    op.create_index("ix_viz_components_widget_type", "viz_components", ["widget_type"])
    op.create_index("ix_viz_components_status", "viz_components", ["status"])
    op.create_index("ix_viz_components_visibility", "viz_components", ["visibility"])
    op.create_index("ix_viz_components_owner_user_id", "viz_components", ["owner_user_id"])

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
    op.drop_index("ix_viz_components_owner_user_id", table_name="viz_components")
    op.drop_index("ix_viz_components_visibility", table_name="viz_components")
    op.drop_index("ix_viz_components_status", table_name="viz_components")
    op.drop_index("ix_viz_components_widget_type", table_name="viz_components")
    op.drop_table("viz_components")
