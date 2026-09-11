from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse, Response
from sqlalchemy.orm import Session

from app.auth.audit.write_hooks import audit_kwargs
from app.auth.deps import UserContext, require_permission
from app.auth.models import get_meta_session
from app.auth.permissions import (
    AuditWriteContext,
    PermissionServiceError,
    get_role_permissions,
    replace_role_permissions,
)
from app.auth.roles import service as role_service
from app.auth.rls.bindings import service as binding_service
from app.auth.schemas import (
    EffectiveDimensionsResponse,
    RoleCreate,
    RoleDimensionGroupsOut,
    RoleDimensionGroupsReplace,
    RoleDimensionValuesOut,
    RoleDimensionValuesReplace,
    RoleListResponse,
    RoleOut,
    RolePermissionsOut,
    RolePermissionsReplace,
    RoleUpdate,
)
from app.auth.users.service import UserError

router = APIRouter(prefix="/roles", tags=["auth"])


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


def _binding_error_response(exc: binding_service.BindingError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": None},
    )


def _permission_error_response(exc: PermissionServiceError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": None},
    )


@router.get("", response_model=RoleListResponse)
def list_roles(
    _: Annotated[UserContext, Depends(require_permission("system:role.read"))],
    db: Annotated[Session, Depends(_db)],
    code_prefix: str | None = None,
    is_active: bool | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> RoleListResponse:
    items, total = role_service.list_roles(db, code_prefix, is_active, limit, offset)
    return RoleListResponse(items=[RoleOut.model_validate(r) for r in items], total=total)


@router.post("", response_model=RoleOut, status_code=status.HTTP_201_CREATED)
def create_role(
    payload: RoleCreate,
    actor: Annotated[UserContext, Depends(require_permission("system:role.manage"))],
    db: Annotated[Session, Depends(_db)],
) -> RoleOut | JSONResponse:
    try:
        role = role_service.create_role(db, payload, **audit_kwargs(actor.id, actor.username))
    except role_service.RoleError as exc:
        return _role_error_response(exc)
    return RoleOut.model_validate(role)


@router.get("/{role_id}", response_model=RoleOut)
def get_role(
    role_id: uuid.UUID,
    _: Annotated[UserContext, Depends(require_permission("system:role.read"))],
    db: Annotated[Session, Depends(_db)],
) -> RoleOut | JSONResponse:
    try:
        role = role_service.get_role(db, role_id)
    except role_service.RoleError as exc:
        return _role_error_response(exc)
    return RoleOut.model_validate(role)


@router.put("/{role_id}", response_model=RoleOut)
def update_role(
    role_id: uuid.UUID,
    payload: RoleUpdate,
    actor: Annotated[UserContext, Depends(require_permission("system:role.manage"))],
    db: Annotated[Session, Depends(_db)],
) -> RoleOut | JSONResponse:
    try:
        role = role_service.update_role(
            db, role_id, payload, **audit_kwargs(actor.id, actor.username)
        )
    except role_service.RoleError as exc:
        return _role_error_response(exc)
    return RoleOut.model_validate(role)


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_role(
    role_id: uuid.UUID,
    actor: Annotated[UserContext, Depends(require_permission("system:role.manage"))],
    db: Annotated[Session, Depends(_db)],
) -> Response:
    try:
        role_service.delete_role(db, role_id, **audit_kwargs(actor.id, actor.username))
    except role_service.RoleError as exc:
        return _role_error_response(exc)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{role_id}/dimension-groups", response_model=RoleDimensionGroupsOut)
def get_role_dimension_groups(
    role_id: uuid.UUID,
    _: Annotated[UserContext, Depends(require_permission("system:rls.read"))],
    db: Annotated[Session, Depends(_db)],
) -> RoleDimensionGroupsOut | JSONResponse:
    try:
        return binding_service.get_role_dimension_groups(db, role_id)
    except role_service.RoleError as exc:
        return _role_error_response(exc)


@router.put("/{role_id}/dimension-groups", response_model=RoleDimensionGroupsOut)
def replace_role_dimension_groups(
    role_id: uuid.UUID,
    payload: RoleDimensionGroupsReplace,
    actor: Annotated[UserContext, Depends(require_permission("system:rls.manage"))],
    db: Annotated[Session, Depends(_db)],
) -> RoleDimensionGroupsOut | JSONResponse:
    ctx = audit_kwargs(actor.id, actor.username)
    try:
        return binding_service.replace_role_dimension_groups(
            db,
            role_id,
            payload.group_ids,
            expected_version=payload.expected_version,
            confirm_empty=payload.confirm_empty,
            **ctx,
        )
    except UserError as exc:
        return JSONResponse(
            status_code=exc.status,
            content={"code": exc.code, "message": exc.message, "detail": None},
        )
    except role_service.RoleError as exc:
        return _role_error_response(exc)
    except binding_service.BindingError as exc:
        return _binding_error_response(exc)


@router.get("/{role_id}/dimension-values", response_model=RoleDimensionValuesOut)
def get_role_dimension_values(
    role_id: uuid.UUID,
    dimension_type_id: Annotated[uuid.UUID, Query(alias="dimensionTypeId")],
    _: Annotated[UserContext, Depends(require_permission("system:rls.read"))],
    db: Annotated[Session, Depends(_db)],
) -> RoleDimensionValuesOut | JSONResponse:
    try:
        return binding_service.get_role_dimension_values(db, role_id, dimension_type_id)
    except role_service.RoleError as exc:
        return _role_error_response(exc)
    except binding_service.BindingError as exc:
        return _binding_error_response(exc)


@router.put("/{role_id}/dimension-values", response_model=RoleDimensionValuesOut)
def replace_role_dimension_values(
    role_id: uuid.UUID,
    payload: RoleDimensionValuesReplace,
    actor: Annotated[UserContext, Depends(require_permission("system:rls.manage"))],
    db: Annotated[Session, Depends(_db)],
) -> RoleDimensionValuesOut | JSONResponse:
    ctx = audit_kwargs(actor.id, actor.username)
    try:
        return binding_service.replace_role_dimension_values(
            db,
            role_id,
            payload.dimension_type_id,
            payload.values,
            expected_version=payload.expected_version,
            confirm_empty=payload.confirm_empty,
            **ctx,
        )
    except UserError as exc:
        return JSONResponse(
            status_code=exc.status,
            content={"code": exc.code, "message": exc.message, "detail": None},
        )
    except role_service.RoleError as exc:
        return _role_error_response(exc)
    except binding_service.BindingError as exc:
        return _binding_error_response(exc)


@router.get("/{role_id}/permissions", response_model=RolePermissionsOut)
def get_role_permission_bindings(
    role_id: uuid.UUID,
    _: Annotated[UserContext, Depends(require_permission("system:role.read"))],
    db: Annotated[Session, Depends(_db)],
) -> RolePermissionsOut | JSONResponse:
    try:
        return get_role_permissions(db, role_id)
    except PermissionServiceError as exc:
        return _permission_error_response(exc)


@router.put("/{role_id}/permissions", response_model=RolePermissionsOut)
def replace_role_permission_bindings(
    role_id: uuid.UUID,
    payload: RolePermissionsReplace,
    actor: Annotated[UserContext, Depends(require_permission("system:role.manage"))],
    db: Annotated[Session, Depends(_db)],
) -> RolePermissionsOut | JSONResponse:
    ctx = audit_kwargs(actor.id, actor.username)
    try:
        return replace_role_permissions(
            db,
            role_id,
            payload.permission_codes,
            payload.expected_version,
            audit=AuditWriteContext(
                actor_id=ctx["actor_id"],
                actor_username=ctx["actor_username"],
                trace_id=ctx["trace_id"],
            ),
        )
    except PermissionServiceError as exc:
        return _permission_error_response(exc)


@router.get("/{role_id}/effective-dimensions", response_model=EffectiveDimensionsResponse)
def get_effective_dimensions(
    role_id: uuid.UUID,
    dimension_type_id: uuid.UUID,
    _: Annotated[UserContext, Depends(require_permission("system:rls.read"))],
    db: Annotated[Session, Depends(_db)],
) -> EffectiveDimensionsResponse | JSONResponse:
    try:
        role_service.get_role(db, role_id)
    except role_service.RoleError as exc:
        return _role_error_response(exc)
    values = binding_service.resolve_effective_values(db, role_id, dimension_type_id)
    return EffectiveDimensionsResponse(dimension_type_id=dimension_type_id, values=values)
