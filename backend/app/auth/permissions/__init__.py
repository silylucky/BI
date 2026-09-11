from __future__ import annotations

from app.auth.permissions.catalog import (
    CATALOG_CODES,
    PERMISSION_BY_CODE,
    PERMISSION_CATALOG,
    PERMISSION_CODE_PATTERN,
    PermissionDefinition,
    is_catalog_code,
    permission_matches,
)
from app.auth.permissions.constants import (
    PERMISSION_NAMESPACE_UUID,
    permission_id_for_code,
)
from app.auth.permissions.service import (
    AuditWriteContext,
    PermissionServiceError,
    get_role_permissions,
    replace_role_permissions,
    resolve_user_permissions,
)

__all__ = [
    "CATALOG_CODES",
    "PERMISSION_BY_CODE",
    "PERMISSION_CATALOG",
    "PERMISSION_CODE_PATTERN",
    "PERMISSION_NAMESPACE_UUID",
    "PermissionDefinition",
    "AuditWriteContext",
    "PermissionServiceError",
    "get_role_permissions",
    "is_catalog_code",
    "permission_matches",
    "permission_id_for_code",
    "replace_role_permissions",
    "resolve_user_permissions",
]
