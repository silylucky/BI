"""auth permission catalog backfill + root admin role invariant

Revision ID: 0025
Revises: 0024

确定性回填（可离线 --sql 渲染、可重复执行无副作用）：
- 权限目录：UUIDv5 确定性 ID upsert（ON CONFLICT DO NOTHING）。
- root 角色：admin 标记 is_system/is_root（ON CONFLICT (code) DO UPDATE）。
- 预置角色映射：analyst/viewer/editor/owner 若存在则按 Global Constraints 授权；
  自定义角色不扩权；不自动为任何用户指派角色。
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

from app.auth.permissions.catalog import PERMISSION_CATALOG
from app.auth.permissions.constants import permission_id_for_code
from migrations.dialect_ops import (
    admin_role_upsert_statement,
    permission_upsert_statement,
    role_permission_mapping_statement,
)

revision: str = "0025"
down_revision: Union[str, None] = "0024"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ROLE_PERMISSION_MAP: dict[str, tuple[str, ...]] = {
    "analyst": (
        "dashboard:read",
        "dashboard:edit",
        "report:read",
        "theme:read",
        "theme:manage",
    ),
    "viewer": ("dashboard:read", "report:read"),
    "editor": ("report:read", "report:manage"),
    "owner": ("report:read", "report:manage"),
}


def upgrade() -> None:
    bind = op.get_bind()
    for definition in PERMISSION_CATALOG:
        pid = permission_id_for_code(definition.code)
        op.execute(
            permission_upsert_statement(
                bind,
                pid=str(pid),
                code=definition.code,
                name=definition.name,
                domain=definition.domain,
                description=definition.description,
            )
        )
    op.execute(admin_role_upsert_statement(bind))
    for role_code, codes in ROLE_PERMISSION_MAP.items():
        op.execute(role_permission_mapping_statement(bind, role_code=role_code, permission_codes=codes))


def downgrade() -> None:
    op.execute("UPDATE auth_roles SET is_root = false, is_system = false WHERE code = 'admin'")
    permission_ids = ", ".join(
        f"'{permission_id_for_code(definition.code)}'" for definition in PERMISSION_CATALOG
    )
    op.execute(f"DELETE FROM auth_role_permissions WHERE permission_id IN ({permission_ids})")
    op.execute(f"DELETE FROM auth_permissions WHERE id IN ({permission_ids})")
