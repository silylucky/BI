"""Grant plugin-management permission to the administrator role.

Revision ID: 0067
Revises: 0066
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

from app.auth.permissions.catalog import PERMISSION_BY_CODE
from app.auth.permissions.constants import permission_id_for_code
from migrations.dialect_ops import permission_upsert_statement, role_permission_mapping_statement

revision: str = "0067"
down_revision: str | None = "0066"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

PLUGIN_MANAGE_PERMISSION = "agent:plugin.manage"


def upgrade() -> None:
    definition = PERMISSION_BY_CODE[PLUGIN_MANAGE_PERMISSION]
    bind = op.get_bind()
    op.execute(
        permission_upsert_statement(
            bind,
            pid=str(permission_id_for_code(definition.code)),
            code=definition.code,
            name=definition.name,
            domain=definition.domain,
            description=definition.description,
        )
    )
    op.execute(
        role_permission_mapping_statement(
            bind,
            role_code="admin",
            permission_codes=(PLUGIN_MANAGE_PERMISSION,),
        )
    )


def downgrade() -> None:
    permission_id = permission_id_for_code(PLUGIN_MANAGE_PERMISSION)
    op.execute(f"DELETE FROM auth_role_permissions WHERE permission_id = '{permission_id}'")
    op.execute(f"DELETE FROM auth_permissions WHERE id = '{permission_id}'")
