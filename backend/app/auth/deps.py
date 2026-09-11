import uuid
from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.auth.models import get_meta_session
from app.auth.permissions import permission_matches
from app.auth.resources.service import VisibilityError, ensure_resource_visible
from app.auth.users import service as user_service


class UserContext(BaseModel):
    id: str
    username: str
    roles: list[str]
    permissions: set[str] = Field(default_factory=set)
    is_root: bool = False


class PermissionDeniedError(Exception):
    """功能权限不足；由统一 handler 转为顶层 PERMISSION_DENIED 响应。"""

    def __init__(self, permission: str) -> None:
        self.permission = permission
        super().__init__(permission)


def require_permission(permission: str):
    """依赖工厂：要求当前用户命中指定功能权限（root 直通）。"""

    async def dependency(
        user: Annotated[UserContext, Depends(get_current_user)],
    ) -> UserContext:
        if not permission_matches(set(user.permissions), permission, user.is_root):
            raise PermissionDeniedError(permission)
        return user

    return dependency


def require_any_permission(*permissions: str):
    """依赖工厂：命中任一功能权限即放行（root 直通）。"""

    async def dependency(
        user: Annotated[UserContext, Depends(get_current_user)],
    ) -> UserContext:
        granted = set(user.permissions)
        if any(
            permission_matches(granted, permission, user.is_root) for permission in permissions
        ):
            return user
        raise PermissionDeniedError(" | ".join(permissions))

    return dependency


async def get_current_user(request: Request) -> UserContext:
    user = getattr(request.state, "user", None)
    if user is None:
        raise HTTPException(
            status_code=401,
            detail={"code": "UNAUTHORIZED", "message": "Not authenticated", "detail": None},
        )
    return user


def resolve_user_roles(user_id: str) -> list[str]:
    session = get_meta_session()
    try:
        return user_service.resolve_role_codes_for_user(session, uuid.UUID(user_id))
    finally:
        session.close()


async def require_resource_visible(
    resource_type: str,
    resource_id: UUID,
    request: Request,
) -> None:
    user = await get_current_user(request)
    session = get_meta_session()
    try:
        ensure_resource_visible(
            session, user.roles, resource_type, resource_id, user_id=user.id
        )
    except VisibilityError as exc:
        raise HTTPException(
            status_code=exc.status,
            detail={"code": exc.code, "message": exc.message, "detail": None},
        ) from exc
    finally:
        session.close()
