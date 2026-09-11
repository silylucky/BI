from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse, Response
from sqlalchemy.orm import Session

from app.auth.audit.write_hooks import audit_kwargs
from app.auth.deps import UserContext, require_permission
from app.auth.models import get_meta_session
from app.auth.rls.dimensions import service as dim_service
from app.auth.rls.groups import service as group_service
from app.auth.rls.column_bindings import service as col_binding_service
from app.auth.schemas import (
    DimensionGroupCreate,
    DimensionGroupListResponse,
    DimensionGroupOut,
    DimensionGroupUpdate,
    DimensionGroupValuesReplace,
    DimensionGroupValuesResponse,
    DimensionTypeCreate,
    DimensionTypeListResponse,
    DimensionTypeOut,
    DimensionTypeUpdate,
    RlsColumnBindingCreate,
    RlsColumnBindingListResponse,
    RlsColumnBindingOut,
    RlsPreviewRequest,
    RlsPreviewResponse,
)

router = APIRouter(prefix="/rls", tags=["auth"])
dimensions_router = APIRouter(prefix="/dimensions")
groups_router = APIRouter(prefix="/groups")


def _db() -> Session:
    session = get_meta_session()
    try:
        yield session
    finally:
        session.close()


def _dim_error_response(exc: dim_service.DimensionError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": None},
    )


def _group_error_response(exc: group_service.GroupError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": None},
    )


def _col_binding_error_response(exc: col_binding_service.ColumnBindingError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": None},
    )


@dimensions_router.get("", response_model=DimensionTypeListResponse)
def list_dimensions(
    _: Annotated[UserContext, Depends(require_permission("system:rls.read"))],
    db: Annotated[Session, Depends(_db)],
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> DimensionTypeListResponse:
    items, total = dim_service.list_dimension_types(db, limit=limit, offset=offset)
    return DimensionTypeListResponse(
        items=[DimensionTypeOut.model_validate(d) for d in items],
        total=total,
    )


@dimensions_router.post("", response_model=DimensionTypeOut, status_code=status.HTTP_201_CREATED)
def create_dimension(
    payload: DimensionTypeCreate,
    actor: Annotated[UserContext, Depends(require_permission("system:rls.manage"))],
    db: Annotated[Session, Depends(_db)],
) -> DimensionTypeOut | JSONResponse:
    try:
        dim = dim_service.create_dimension_type(
            db, payload, **audit_kwargs(actor.id, actor.username)
        )
    except dim_service.DimensionError as exc:
        return _dim_error_response(exc)
    return DimensionTypeOut.model_validate(dim)


@dimensions_router.get("/{dim_id}", response_model=DimensionTypeOut)
def get_dimension(
    dim_id: uuid.UUID,
    _: Annotated[UserContext, Depends(require_permission("system:rls.read"))],
    db: Annotated[Session, Depends(_db)],
) -> DimensionTypeOut | JSONResponse:
    try:
        dim = dim_service.get_dimension_type(db, dim_id)
    except dim_service.DimensionError as exc:
        return _dim_error_response(exc)
    return DimensionTypeOut.model_validate(dim)


@dimensions_router.put("/{dim_id}", response_model=DimensionTypeOut)
def update_dimension(
    dim_id: uuid.UUID,
    payload: DimensionTypeUpdate,
    actor: Annotated[UserContext, Depends(require_permission("system:rls.manage"))],
    db: Annotated[Session, Depends(_db)],
) -> DimensionTypeOut | JSONResponse:
    try:
        dim = dim_service.update_dimension_type(
            db, dim_id, payload, **audit_kwargs(actor.id, actor.username)
        )
    except dim_service.DimensionError as exc:
        return _dim_error_response(exc)
    return DimensionTypeOut.model_validate(dim)


@dimensions_router.delete("/{dim_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dimension(
    dim_id: uuid.UUID,
    actor: Annotated[UserContext, Depends(require_permission("system:rls.manage"))],
    db: Annotated[Session, Depends(_db)],
) -> Response:
    try:
        dim_service.delete_dimension_type(db, dim_id, **audit_kwargs(actor.id, actor.username))
    except dim_service.DimensionError as exc:
        return _dim_error_response(exc)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@groups_router.get("", response_model=DimensionGroupListResponse)
def list_groups(
    _: Annotated[UserContext, Depends(require_permission("system:rls.read"))],
    db: Annotated[Session, Depends(_db)],
    dimension_type_id: uuid.UUID | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> DimensionGroupListResponse:
    items, total = group_service.list_groups(
        db, dimension_type_id=dimension_type_id, limit=limit, offset=offset
    )
    return DimensionGroupListResponse(
        items=[DimensionGroupOut.model_validate(g) for g in items],
        total=total,
    )


@groups_router.post("", response_model=DimensionGroupOut, status_code=status.HTTP_201_CREATED)
def create_group(
    payload: DimensionGroupCreate,
    actor: Annotated[UserContext, Depends(require_permission("system:rls.manage"))],
    db: Annotated[Session, Depends(_db)],
) -> DimensionGroupOut | JSONResponse:
    try:
        group = group_service.create_group(
            db, payload, **audit_kwargs(actor.id, actor.username)
        )
    except group_service.GroupError as exc:
        return _group_error_response(exc)
    return DimensionGroupOut.model_validate(group)


@groups_router.get("/{group_id}", response_model=DimensionGroupOut)
def get_group(
    group_id: uuid.UUID,
    _: Annotated[UserContext, Depends(require_permission("system:rls.read"))],
    db: Annotated[Session, Depends(_db)],
) -> DimensionGroupOut | JSONResponse:
    try:
        group = group_service.get_group(db, group_id)
    except group_service.GroupError as exc:
        return _group_error_response(exc)
    return DimensionGroupOut.model_validate(group)


@groups_router.put("/{group_id}", response_model=DimensionGroupOut)
def update_group(
    group_id: uuid.UUID,
    payload: DimensionGroupUpdate,
    actor: Annotated[UserContext, Depends(require_permission("system:rls.manage"))],
    db: Annotated[Session, Depends(_db)],
) -> DimensionGroupOut | JSONResponse:
    try:
        group = group_service.update_group(
            db, group_id, payload, **audit_kwargs(actor.id, actor.username)
        )
    except group_service.GroupError as exc:
        return _group_error_response(exc)
    return DimensionGroupOut.model_validate(group)


@groups_router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_group(
    group_id: uuid.UUID,
    actor: Annotated[UserContext, Depends(require_permission("system:rls.manage"))],
    db: Annotated[Session, Depends(_db)],
) -> Response:
    try:
        group_service.delete_group(db, group_id, **audit_kwargs(actor.id, actor.username))
    except group_service.GroupError as exc:
        return _group_error_response(exc)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@groups_router.get("/{group_id}/values", response_model=DimensionGroupValuesResponse)
def list_group_values(
    group_id: uuid.UUID,
    _: Annotated[UserContext, Depends(require_permission("system:rls.read"))],
    db: Annotated[Session, Depends(_db)],
) -> DimensionGroupValuesResponse | JSONResponse:
    try:
        values = group_service.list_group_values(db, group_id)
    except group_service.GroupError as exc:
        return _group_error_response(exc)
    return DimensionGroupValuesResponse(items=values)


@groups_router.post("/{group_id}/values", response_model=DimensionGroupValuesResponse)
def add_group_values(
    group_id: uuid.UUID,
    payload: DimensionGroupValuesReplace,
    actor: Annotated[UserContext, Depends(require_permission("system:rls.manage"))],
    db: Annotated[Session, Depends(_db)],
) -> DimensionGroupValuesResponse | JSONResponse:
    try:
        values = group_service.add_group_values(
            db, group_id, payload.values, **audit_kwargs(actor.id, actor.username)
        )
    except group_service.GroupError as exc:
        return _group_error_response(exc)
    return DimensionGroupValuesResponse(items=values)


@groups_router.put("/{group_id}/values", response_model=DimensionGroupValuesResponse)
def replace_group_values(
    group_id: uuid.UUID,
    payload: DimensionGroupValuesReplace,
    actor: Annotated[UserContext, Depends(require_permission("system:rls.manage"))],
    db: Annotated[Session, Depends(_db)],
) -> DimensionGroupValuesResponse | JSONResponse:
    try:
        values = group_service.replace_group_values(
            db, group_id, payload.values, **audit_kwargs(actor.id, actor.username)
        )
    except group_service.GroupError as exc:
        return _group_error_response(exc)
    return DimensionGroupValuesResponse(items=values)


@groups_router.delete("/{group_id}/values/{value}", status_code=status.HTTP_204_NO_CONTENT)
def remove_group_value(
    group_id: uuid.UUID,
    value: str,
    actor: Annotated[UserContext, Depends(require_permission("system:rls.manage"))],
    db: Annotated[Session, Depends(_db)],
) -> Response:
    try:
        group_service.remove_group_value(
            db, group_id, value, **audit_kwargs(actor.id, actor.username)
        )
    except group_service.GroupError as exc:
        return _group_error_response(exc)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


router.include_router(dimensions_router)
router.include_router(groups_router)


@router.get("/column-bindings", response_model=RlsColumnBindingListResponse)
def list_column_bindings(
    _: Annotated[UserContext, Depends(require_permission("system:rls.read"))],
    db: Annotated[Session, Depends(_db)],
    datasource_id: uuid.UUID | None = Query(default=None, alias="datasourceId"),
    dataset_id: str | None = Query(default=None, alias="datasetId"),
    table_name: str | None = Query(default=None, alias="tableName"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> RlsColumnBindingListResponse:
    items, total = col_binding_service.list_column_bindings(
        db,
        datasource_id=datasource_id,
        dataset_id=dataset_id,
        table_name=table_name,
        limit=limit,
        offset=offset,
    )
    return RlsColumnBindingListResponse(
        items=[RlsColumnBindingOut.model_validate(i) for i in items],
        total=total,
    )


@router.post(
    "/column-bindings",
    response_model=RlsColumnBindingOut,
    status_code=status.HTTP_201_CREATED,
)
def create_column_binding(
    payload: RlsColumnBindingCreate,
    _: Annotated[UserContext, Depends(require_permission("system:rls.manage"))],
    db: Annotated[Session, Depends(_db)],
) -> RlsColumnBindingOut | JSONResponse:
    try:
        row = col_binding_service.create_column_binding(
            db,
            datasource_id=payload.datasource_id,
            dataset_id=payload.dataset_id,
            table_name=payload.table_name,
            dimension_type_id=payload.dimension_type_id,
            column_name=payload.column_name,
        )
    except col_binding_service.ColumnBindingError as exc:
        return _col_binding_error_response(exc)
    return RlsColumnBindingOut.model_validate(row)


@router.delete("/column-bindings/{binding_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_column_binding(
    binding_id: uuid.UUID,
    _: Annotated[UserContext, Depends(require_permission("system:rls.manage"))],
    db: Annotated[Session, Depends(_db)],
) -> Response:
    try:
        col_binding_service.delete_column_binding(db, binding_id)
    except col_binding_service.ColumnBindingError as exc:
        return _col_binding_error_response(exc)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/preview", response_model=RlsPreviewResponse)
def preview_rls(
    payload: RlsPreviewRequest,
    actor: Annotated[UserContext, Depends(require_permission("system:rls.read"))],
    db: Annotated[Session, Depends(_db)],
) -> RlsPreviewResponse | JSONResponse:
    from app.auth.rls.predicate import RlsConfigError

    column_map = col_binding_service.resolve_column_map(
        db,
        datasource_id=payload.datasource_id,
        dataset_id=payload.dataset_id,
        table_name=payload.table_name,
    )
    try:
        fragment = col_binding_service.preview_rls_fragment(
            db,
            uuid.UUID(actor.id),
            column_by_dimension_id=column_map or None,
            table_alias=payload.table_alias,
            org_column=payload.org_column,
        )
    except (col_binding_service.ColumnBindingError, RlsConfigError) as exc:
        code = getattr(exc, "code", "RLS_CONFIG_INVALID")
        message = getattr(exc, "message", str(exc))
        status_code = getattr(exc, "status", 400)
        return JSONResponse(
            status_code=status_code,
            content={"code": code, "message": message, "detail": None},
        )
    return RlsPreviewResponse(fragment=fragment, tableAlias=payload.table_alias)
