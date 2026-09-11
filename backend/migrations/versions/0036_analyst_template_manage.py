"""grant analyst dashboard:template.manage

Revision ID: 0036
Revises: 0035
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

from migrations.dialect_ops import role_permission_mapping_statement

revision: str = "0036"
down_revision: Union[str, None] = "0035"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_PERMISSION = "dashboard:template.manage"


def upgrade() -> None:
    bind = op.get_bind()
    op.execute(
        role_permission_mapping_statement(
            bind,
            role_code="analyst",
            permission_codes=(NEW_PERMISSION,),
        )
    )


def downgrade() -> None:
    from app.auth.permissions.constants import permission_id_for_code

    pid = permission_id_for_code(NEW_PERMISSION)
    op.execute(
        "DELETE FROM auth_role_permissions "
        f"WHERE permission_id = '{pid}' "
        "AND role_id IN (SELECT id FROM auth_roles WHERE code = 'analyst')"
    )
