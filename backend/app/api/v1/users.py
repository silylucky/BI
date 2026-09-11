from __future__ import annotations

import uuid
import uuid as uuid_mod
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse, Response
from sqlalchemy.orm import Session

from app.auth.deps import UserContext, require_any_permission, require_permission
from app.auth.org_scope import list_filter_org_ids
from app.auth.models import get_meta_session
from app.auth.password.service import PasswordPolicyError
from app.auth.schemas import (
    ResetPasswordOut,
    UserCreate,
    UserListItemOut,
    UserListResponse,
    UserOrgAssign,
    UserOrgResponse,
    UserOut,
    UserRoleOut,
    UserRolesReplace,
    UserRolesResponse,
    UserUpdate,
)
from app.auth.schemas_phase_c import (
    UserDimensionOverrideListResponse,
    UserDimensionOverrideOut,
    UserDimensionOverrideUpsert,
    UserResourceGrantListResponse,
    UserResourceGrantOut,
    UserResourceGrantUpsert,
)
from app.auth.user_overrides import service as override_service
from app.auth.users import service as user_service
from app.auth.roles import service as role_service
from app.core.logging import trace_id_var

PERM_USER_READ = "system:user.read"
PERM_USER_MANAGE = "system:user.manage"
PERM_ORG_SCOPED_MANAGE = "system:org_scoped.manage"
PERM_USER_PASSWORD_RESET = "system:user.password.reset"

router = APIRouter(prefix="/users", tags=["auth"])


def _db() -> Session:
    session = get_meta_session()
    try:
        yield session
    finally:
        session.close()


def _role_error_response(exc: role_service.RoleError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": None},
    )


def _user_error_response(exc: user_service.UserError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": None},
    )


def _binding_context(actor: UserContext) -> dict[str, str | list[str] | None]:
    trace = trace_id_var.get() or uuid_mod.uuid4().hex
    return {
        "actor_id": actor.id,
        "actor_username": actor.username,
        "actor_roles": actor.roles,
        "trace_id": trace,
    }


def _to_user_out(db: Session, user) -> UserOut:
    return UserOut.model_validate(user)


def _audit_context(actor: UserContext) -> dict[str, str | None]:
    trace = trace_id_var.get() or uuid_mod.uuid4().hex
    return {
        "actor_id": actor.id,
        "actor_username": actor.username,
        "trace_id": trace,
    }


def _actor_scope(actor: UserContext) -> dict[str, object]:
    return {
        "actor_permissions": set(actor.permissions),
        "actor_is_root": actor.is_root,
    }


def _override_error(exc: override_service.OverrideError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": None},
    )


@router.get("", response_model=UserListResponse)
def list_users(
    actor: Annotated[
        UserContext,
        Depends(require_any_permission(PERM_USER_READ, PERM_ORG_SCOPED_MANAGE)),
    ],
    db: Annotated[Session, Depends(_db)],
    q: str | None = None,
    org_id: uuid.UUID | None = Query(default=None, alias="orgId"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> UserListResponse:
    org_filter = list_filter_org_ids(
        db,
        permissions=set(actor.permissions),
        is_root=actor.is_root,
        actor_user_id=actor.id,
    )
    if org_filter is not None:
        if org_id is not None and org_id not in org_filter:
            return UserListResponse(items=[], total=0)
        effective_orgs = [org_id] if org_id is not None else org_filter
    else:
        effective_orgs = [org_id] if org_id is not None else None
    items, total = user_service.list_users(db, q, limit, offset, org_node_ids=effective_orgs)
    role_map = user_service.list_users_role_map(db, [u.id for u in items])
    out_items = [
        UserListItemOut(
            **_to_user_out(db, u).model_dump(),
            roles=[UserRoleOut(id=r.id, code=r.code, name=r.name) for r in role_map.get(u.id, [])],
        )
        for u in items
    ]
    return UserListResponse(items=out_items, total=total)


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    actor: Annotated[
        UserContext,
        Depends(require_any_permission(PERM_USER_MANAGE, PERM_ORG_SCOPED_MANAGE)),
    ],
    db: Annotated[Session, Depends(_db)],
) -> UserOut | JSONResponse:
    try:
        user = user_service.create_user(
            db, payload, **_audit_context(actor), **_actor_scope(actor)
        )
    except PasswordPolicyError as exc:
        return JSONResponse(
            status_code=exc.status,
            content={"code": exc.code, "message": exc.message, "detail": None},
        )
    except user_service.UserError as exc:
        return _user_error_response(exc)
    return _to_user_out(db, user)


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: uuid.UUID,
    payload: UserUpdate,
    actor: Annotated[
        UserContext,
        Depends(require_any_permission(PERM_USER_MANAGE, PERM_ORG_SCOPED_MANAGE)),
    ],
    db: Annotated[Session, Depends(_db)],
) -> UserOut | JSONResponse:
    try:
        user = user_service.update_user(
            db, user_id, payload, **_audit_context(actor), **_actor_scope(actor)
        )
    except user_service.UserError as exc:
        return _user_error_response(exc)
    except role_service.RoleError as exc:
        return _role_error_response(exc)
    return _to_user_out(db, user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_user(
    user_id: uuid.UUID,
    actor: Annotated[UserContext, Depends(require_permission(PERM_USER_MANAGE))],
    db: Annotated[Session, Depends(_db)],
):
    ctx = _binding_context(actor)
    try:
        user_service.delete_user(db, user_id, **ctx)
    except user_service.UserError as exc:
        return _user_error_response(exc)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{user_id}/disable", response_model=UserOut)
def disable_user(
    user_id: uuid.UUID,
    actor: Annotated[UserContext, Depends(require_permission(PERM_USER_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> UserOut | JSONResponse:
    ctx = _binding_context(actor)
    try:
        user = user_service.set_user_active(db, user_id, False, **ctx)
    except user_service.UserError as exc:
        return _user_error_response(exc)
    return _to_user_out(db, user)


@router.post("/{user_id}/enable", response_model=UserOut)
def enable_user(
    user_id: uuid.UUID,
    actor: Annotated[UserContext, Depends(require_permission(PERM_USER_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> UserOut | JSONResponse:
    ctx = _binding_context(actor)
    try:
        user = user_service.set_user_active(db, user_id, True, **ctx)
    except user_service.UserError as exc:
        return _user_error_response(exc)
    return _to_user_out(db, user)


@router.post("/{user_id}/unlock", response_model=UserOut)
def unlock_user(
    user_id: uuid.UUID,
    actor: Annotated[UserContext, Depends(require_permission(PERM_USER_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> UserOut | JSONResponse:
    try:
        user = user_service.unlock_user(db, user_id, **_audit_context(actor))
    except user_service.UserError as exc:
        return _user_error_response(exc)
    return _to_user_out(db, user)


@router.post("/{user_id}/reset-password", response_model=ResetPasswordOut)
def reset_user_password(
    user_id: uuid.UUID,
    actor: Annotated[UserContext, Depends(require_permission(PERM_USER_PASSWORD_RESET))],
    db: Annotated[Session, Depends(_db)],
) -> Response | JSONResponse:
    try:
        temporary, changed_at = user_service.reset_password(
            db, user_id, **_audit_context(actor)
        )
    except user_service.UserError as exc:
        return _user_error_response(exc)
    body = ResetPasswordOut(temporary_password=temporary, password_changed_at=changed_at)
    return JSONResponse(
        content=body.model_dump(mode="json", by_alias=True),
        headers={"Cache-Control": "no-store"},
    )


@router.get("/{user_id}/roles", response_model=UserRolesResponse)
def list_user_roles(
    user_id: uuid.UUID,
    _: Annotated[UserContext, Depends(require_permission(PERM_USER_READ))],
    db: Annotated[Session, Depends(_db)],
) -> UserRolesResponse | JSONResponse:
    try:
        roles = user_service.list_user_roles(db, user_id)
    except user_service.UserError as exc:
        return _user_error_response(exc)
    items = [UserRoleOut(id=r.id, code=r.code, name=r.name) for r in roles]
    return UserRolesResponse(items=items)


@router.put("/{user_id}/roles", response_model=UserRolesResponse)
def replace_user_roles(
    user_id: uuid.UUID,
    payload: UserRolesReplace,
    actor: Annotated[UserContext, Depends(require_permission(PERM_USER_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> UserRolesResponse | JSONResponse:
    ctx = _binding_context(actor)
    try:
        roles = user_service.replace_user_roles(db, user_id, payload.role_ids, **ctx)
    except user_service.UserError as exc:
        return _user_error_response(exc)
    except role_service.RoleError as exc:
        return _role_error_response(exc)
    items = [UserRoleOut(id=r.id, code=r.code, name=r.name) for r in roles]
    return UserRolesResponse(items=items)


@router.post("/{user_id}/roles/{role_id}", status_code=status.HTTP_200_OK, response_model=None)
def bind_user_role(
    user_id: uuid.UUID,
    role_id: uuid.UUID,
    actor: Annotated[UserContext, Depends(require_permission(PERM_USER_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> JSONResponse | dict[str, str]:
    ctx = _binding_context(actor)
    try:
        user_service.bind_role(db, user_id, role_id, **ctx)
    except user_service.UserError as exc:
        return _user_error_response(exc)
    except role_service.RoleError as exc:
        return _role_error_response(exc)
    return {"status": "ok"}


@router.delete("/{user_id}/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
def unbind_user_role(
    user_id: uuid.UUID,
    role_id: uuid.UUID,
    actor: Annotated[UserContext, Depends(require_permission(PERM_USER_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> Response:
    ctx = _binding_context(actor)
    try:
        user_service.unbind_role(db, user_id, role_id, **ctx)
    except user_service.UserError as exc:
        return _user_error_response(exc)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/{user_id}/org", response_model=UserOrgResponse)
def assign_user_org(
    user_id: uuid.UUID,
    payload: UserOrgAssign,
    actor: Annotated[UserContext, Depends(require_permission(PERM_USER_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> UserOrgResponse | JSONResponse:
    ctx = _binding_context(actor)
    try:
        user_service.assign_user_org(db, user_id, payload.org_node_id, **ctx)
        node = user_service.get_user_org(db, user_id)
    except user_service.UserError as exc:
        return _user_error_response(exc)
    assert node is not None
    return UserOrgResponse.model_validate(node)


@router.get("/{user_id}/org", response_model=UserOrgResponse)
def get_user_org(
    user_id: uuid.UUID,
    _: Annotated[UserContext, Depends(require_permission(PERM_USER_READ))],
    db: Annotated[Session, Depends(_db)],
) -> UserOrgResponse | JSONResponse:
    try:
        node = user_service.get_user_org(db, user_id)
    except user_service.UserError as exc:
        return _user_error_response(exc)
    if node is None:
        return JSONResponse(
            status_code=404,
            content={"code": "USER_ORG_NOT_SET", "message": "User has no org assignment", "detail": None},
        )
    return UserOrgResponse.model_validate(node)


@router.delete("/{user_id}/org", status_code=status.HTTP_204_NO_CONTENT)
def clear_user_org_route(
    user_id: uuid.UUID,
    actor: Annotated[UserContext, Depends(require_permission(PERM_USER_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> Response:
    ctx = _binding_context(actor)
    try:
        user_service.clear_user_org(db, user_id, **ctx)
    except user_service.UserError as exc:
        return _user_error_response(exc)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{user_id}/resource-grants", response_model=UserResourceGrantListResponse)
def list_user_resource_grants(
    user_id: uuid.UUID,
    actor: Annotated[
        UserContext,
        Depends(require_any_permission(PERM_USER_READ, PERM_ORG_SCOPED_MANAGE)),
    ],
    db: Annotated[Session, Depends(_db)],
) -> UserResourceGrantListResponse | JSONResponse:
    try:
        user_service.get_user(db, user_id)
        items = [
            UserResourceGrantOut.model_validate(row)
            for row in override_service.list_user_resource_grants(db, user_id)
        ]
    except user_service.UserError as exc:
        return _user_error_response(exc)
    return UserResourceGrantListResponse(items=items)


@router.put("/{user_id}/resource-grants", response_model=UserResourceGrantOut)
def upsert_user_resource_grant(
    user_id: uuid.UUID,
    payload: UserResourceGrantUpsert,
    actor: Annotated[
        UserContext,
        Depends(require_any_permission(PERM_USER_MANAGE, PERM_ORG_SCOPED_MANAGE)),
    ],
    db: Annotated[Session, Depends(_db)],
) -> UserResourceGrantOut | JSONResponse:
    try:
        row = override_service.upsert_user_resource_grant(
            db,
            user_id=user_id,
            resource_type=payload.resource_type,
            resource_id=payload.resource_id,
            effect=payload.effect,
            actor_id=actor.id,
            actor_username=actor.username,
            actor_permissions=set(actor.permissions),
            actor_is_root=actor.is_root,
            trace_id=trace_id_var.get() or uuid_mod.uuid4().hex,
        )
    except override_service.OverrideError as exc:
        return _override_error(exc)
    return UserResourceGrantOut.model_validate(row)


@router.delete("/{user_id}/resource-grants/{grant_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_user_resource_grant_route(
    user_id: uuid.UUID,
    grant_id: uuid.UUID,
    actor: Annotated[
        UserContext,
        Depends(require_any_permission(PERM_USER_MANAGE, PERM_ORG_SCOPED_MANAGE)),
    ],
    db: Annotated[Session, Depends(_db)],
) -> Response | JSONResponse:
    _ = user_id
    try:
        override_service.delete_user_resource_grant(
            db,
            grant_id,
            actor_id=actor.id,
            actor_username=actor.username,
            actor_permissions=set(actor.permissions),
            actor_is_root=actor.is_root,
            trace_id=trace_id_var.get() or uuid_mod.uuid4().hex,
        )
    except override_service.OverrideError as exc:
        return _override_error(exc)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{user_id}/dimension-overrides", response_model=UserDimensionOverrideListResponse)
def list_user_dimension_overrides(
    user_id: uuid.UUID,
    actor: Annotated[
        UserContext,
        Depends(require_any_permission(PERM_USER_READ, PERM_ORG_SCOPED_MANAGE)),
    ],
    db: Annotated[Session, Depends(_db)],
) -> UserDimensionOverrideListResponse | JSONResponse:
    try:
        user_service.get_user(db, user_id)
        items = [
            UserDimensionOverrideOut.model_validate(row)
            for row in override_service.list_user_dimension_overrides(db, user_id)
        ]
    except user_service.UserError as exc:
        return _user_error_response(exc)
    return UserDimensionOverrideListResponse(items=items)


@router.put("/{user_id}/dimension-overrides", response_model=UserDimensionOverrideOut)
def upsert_user_dimension_override(
    user_id: uuid.UUID,
    payload: UserDimensionOverrideUpsert,
    actor: Annotated[
        UserContext,
        Depends(require_any_permission(PERM_USER_MANAGE, PERM_ORG_SCOPED_MANAGE)),
    ],
    db: Annotated[Session, Depends(_db)],
) -> UserDimensionOverrideOut | JSONResponse:
    try:
        row = override_service.upsert_user_dimension_override(
            db,
            user_id=user_id,
            dimension_type_id=payload.dimension_type_id,
            value=payload.value,
            effect=payload.effect,
            actor_id=actor.id,
            actor_username=actor.username,
            actor_permissions=set(actor.permissions),
            actor_is_root=actor.is_root,
            trace_id=trace_id_var.get() or uuid_mod.uuid4().hex,
        )
    except override_service.OverrideError as exc:
        return _override_error(exc)
    return UserDimensionOverrideOut.model_validate(row)


@router.delete(
    "/{user_id}/dimension-overrides/{dimension_type_id}/{value}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
)
def delete_user_dimension_override_route(
    user_id: uuid.UUID,
    dimension_type_id: uuid.UUID,
    value: str,
    actor: Annotated[
        UserContext,
        Depends(require_any_permission(PERM_USER_MANAGE, PERM_ORG_SCOPED_MANAGE)),
    ],
    db: Annotated[Session, Depends(_db)],
) -> Response | JSONResponse:
    try:
        override_service.delete_user_dimension_override(
            db,
            user_id=user_id,
            dimension_type_id=dimension_type_id,
            value=value,
            actor_id=actor.id,
            actor_username=actor.username,
            actor_permissions=set(actor.permissions),
            actor_is_root=actor.is_root,
            trace_id=trace_id_var.get() or uuid_mod.uuid4().hex,
        )
    except override_service.OverrideError as exc:
        return _override_error(exc)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
