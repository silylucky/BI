from __future__ import annotations

import uuid
from typing import Annotated

import app.datasources  # noqa: F401 — trigger register_builtin_dialects
from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.responses import JSONResponse, Response
from sqlalchemy.orm import Session

from app.auth.deps import UserContext, require_permission

PERM_READ = "datasource:read"
PERM_MANAGE = "datasource:manage"
from app.auth.resources.service import VisibilityError
from app.datasources.models import get_meta_session
from app.datasources.metadata import service as metadata_service
from app.datasources.schemas import (
    ColumnListResponse,
    ConnectorTypeListResponse,
    ConnectorTypeOut,
    DataSourceCreate,
    DataSourceListResponse,
    DataSourceOut,
    DataSourcePatch,
    DataSourceUpdate,
    SchemaListResponse,
    TableListResponse,
    TestConnectionIn,
    TestConnectionOut,
)
from app.datasources import service as ds_service
from app.datasources.dialects.kingbase.params import KingbaseParamsError, validate_kingbase_connection_params
from app.datasources.registry import export_type_catalog

router = APIRouter(prefix="/datasources", tags=["datasources"])


def _db() -> Session:
    session = get_meta_session()
    try:
        yield session
    finally:
        session.close()


def _error_response(exc: ds_service.DataSourceError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": None},
    )


def _visibility_response(exc: VisibilityError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": None},
    )


@router.get("", response_model=DataSourceListResponse)
def list_data_sources(
    user: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    type: str | None = None,
    q: str | None = None,
    include_managed: bool = Query(False, alias="includeManaged"),
) -> DataSourceListResponse:
    return ds_service.list_data_sources(
        db,
        role_codes=user.roles,
        is_root=user.is_root,
        limit=limit,
        offset=offset,
        type=type,
        q=q,
        include_managed=include_managed,
    )


@router.post(
    "",
    response_model=DataSourceOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create data source (IF-06)",
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "example": {
                        "name": "Analytics MySQL",
                        "type": "mysql",
                        "host": "db.example.com",
                        "port": 3306,
                        "database": "analytics",
                        "username": "reader",
                        "password": "***",
                    }
                }
            }
        }
    },
)
def create_data_source(
    payload: DataSourceCreate,
    _: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> DataSourceOut | JSONResponse:
    try:
        return ds_service.create_data_source(db, payload)
    except ds_service.DataSourceError as exc:
        return _error_response(exc)


@router.get("/types", response_model=ConnectorTypeListResponse)
def list_connector_types(
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
) -> ConnectorTypeListResponse:
    items = [ConnectorTypeOut.model_validate(item) for item in export_type_catalog()]
    return ConnectorTypeListResponse(items=items)


@router.get("/{data_source_id}", response_model=DataSourceOut)
def get_data_source(
    data_source_id: uuid.UUID,
    user: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
) -> DataSourceOut | JSONResponse:
    try:
        return ds_service.get_data_source(db, data_source_id, role_codes=user.roles, is_root=user.is_root)
    except ds_service.DataSourceError as exc:
        return _error_response(exc)
    except VisibilityError as exc:
        return _visibility_response(exc)


@router.put("/{data_source_id}", response_model=DataSourceOut)
def update_data_source(
    data_source_id: uuid.UUID,
    payload: DataSourceUpdate,
    user: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> DataSourceOut | JSONResponse:
    try:
        return ds_service.update_data_source(db, data_source_id, payload, role_codes=user.roles, is_root=user.is_root)
    except ds_service.DataSourceError as exc:
        return _error_response(exc)
    except VisibilityError as exc:
        return _visibility_response(exc)


@router.patch("/{data_source_id}", response_model=DataSourceOut)
def patch_data_source(
    data_source_id: uuid.UUID,
    payload: DataSourcePatch,
    user: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> DataSourceOut | JSONResponse:
    try:
        return ds_service.patch_data_source(db, data_source_id, payload, role_codes=user.roles, is_root=user.is_root)
    except ds_service.DataSourceError as exc:
        return _error_response(exc)
    except VisibilityError as exc:
        return _visibility_response(exc)


@router.delete("/{data_source_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_data_source(
    data_source_id: uuid.UUID,
    user: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> Response:
    try:
        ds_service.delete_data_source(db, data_source_id, role_codes=user.roles, is_root=user.is_root)
    except ds_service.DataSourceError as exc:
        return _error_response(exc)
    except VisibilityError as exc:
        return _visibility_response(exc)
    from app.auth.audit.write_hooks import record_domain_delete

    record_domain_delete(
        db,
        actor_id=user.id,
        actor_username=user.username,
        target_type="datasource",
        target_id=data_source_id,
    )
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/test", response_model=TestConnectionOut)
async def test_connection_draft(
    request: Request,
    _: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
) -> TestConnectionOut | JSONResponse:
    body = await request.json()
    if body.get("type") == "kingbase":
        try:
            validate_kingbase_connection_params(
                host=body.get("host"),
                port=body.get("port"),
                database=body.get("database"),
                username=body.get("username"),
            )
        except KingbaseParamsError as exc:
            detail = {"fields": exc.fields} if exc.fields else None
            return JSONResponse(
                status_code=422,
                content={"code": exc.code, "message": exc.message, "detail": detail},
            )
    try:
        payload = TestConnectionIn.model_validate(body)
    except Exception as exc:
        return JSONResponse(
            status_code=422,
            content={"code": "VALIDATION_ERROR", "message": str(exc), "detail": None},
        )
    try:
        return ds_service.test_connection_draft(payload)
    except ds_service.DataSourceError as exc:
        return _error_response(exc)


@router.post("/{data_source_id}/test", response_model=TestConnectionOut)
def test_connection_saved(
    data_source_id: uuid.UUID,
    user: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> TestConnectionOut | JSONResponse:
    try:
        return ds_service.test_connection_by_id(db, data_source_id, role_codes=user.roles, is_root=user.is_root)
    except ds_service.DataSourceError as exc:
        return _error_response(exc)
    except VisibilityError as exc:
        return _visibility_response(exc)


@router.get("/{data_source_id}/schemas", response_model=SchemaListResponse)
def get_schemas(
    data_source_id: uuid.UUID,
    user: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
) -> SchemaListResponse | JSONResponse:
    try:
        return metadata_service.list_schemas(db, user.roles, data_source_id, is_root=user.is_root)
    except ds_service.DataSourceError as exc:
        return _error_response(exc)
    except VisibilityError as exc:
        return _visibility_response(exc)


@router.get("/{data_source_id}/tables", response_model=TableListResponse)
def get_tables(
    data_source_id: uuid.UUID,
    user: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
    schema: str = "",
) -> TableListResponse | JSONResponse:
    try:
        return metadata_service.list_tables(db, user.roles, data_source_id, schema, is_root=user.is_root)
    except ds_service.DataSourceError as exc:
        return _error_response(exc)
    except VisibilityError as exc:
        return _visibility_response(exc)


@router.get("/{data_source_id}/columns", response_model=ColumnListResponse)
def get_columns(
    data_source_id: uuid.UUID,
    user: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
    schema: str = "",
    table: str = "",
) -> ColumnListResponse | JSONResponse:
    try:
        return metadata_service.list_columns(db, user.roles, data_source_id, schema, table, is_root=user.is_root)
    except ds_service.DataSourceError as exc:
        return _error_response(exc)
    except VisibilityError as exc:
        return _visibility_response(exc)
