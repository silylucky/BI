from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.auth.deps import UserContext, require_permission
from app.auth.permissions import PERMISSION_CATALOG, permission_id_for_code
from app.auth.schemas import PermissionListOut, PermissionOut

router = APIRouter(prefix="/permissions", tags=["auth"])


@router.get("", response_model=PermissionListOut)
def list_permissions(
    _: Annotated[UserContext, Depends(require_permission("system:role.read"))],
) -> PermissionListOut:
    items = [
        PermissionOut(
            id=permission_id_for_code(definition.code),
            code=definition.code,
            name=definition.name,
            domain=definition.domain,
            description=definition.description,
        )
        for definition in PERMISSION_CATALOG
    ]
    return PermissionListOut(items=items)
