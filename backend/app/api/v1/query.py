from __future__ import annotations

import uuid
from typing import Annotated

import app.datasources  # noqa: F401 — register_builtin_dialects
from fastapi import APIRouter, Depends, Query, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.auth.deps import UserContext, require_permission

PERM_DS_READ = "datasource:read"
PERM_DATASET_READ = "dataset:read"
PERM_DATASET_MANAGE = "dataset:manage"
from app.auth.resources.service import VisibilityError
from app.datasources.models import get_meta_session
from app.query import binding_service
from app.query import service as query_service
from app.query.schemas import (
    BindingCreate,
    BindingListResponse,
    BindingOut,
    BindingUpdate,
    ExecuteRequest,
    ExecuteResponse,
    QueryError,
)
from app.query.translator.schemas import TranslateError, TranslateRequest, TranslateResponse
from app.query.translator import service as translator_service
from app.query.native.guard import assert_readonly_route_guard, list_routing_modes, validate_native_spec
from app.query.native.schemas import (
    NativeQuerySpec,
    NativeValidateOut,
    ReadonlyGuardIn,
    ReadonlyGuardOut,
    RoutingModesOut,
)
from app.query.dataset.guard import dataset_routing_doc, validate_dataset_spec
from app.query.dataset.executor import build_dataset_execute_plan
from app.query.dataset.execute_config import execute_dataset_from_config
from app.query.dataset.schemas import (
    DatasetExecutePlanOut,
    DatasetExecuteRequest,
    DatasetExecuteResponse,
    DatasetRoutingOut,
)

router = APIRouter(prefix="/query", tags=["query"])


def _db() -> Session:
    session = get_meta_session()
    try:
        yield session
    finally:
        session.close()


def _error_response(exc: QueryError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": None},
    )


def _translate_error(exc: TranslateError) -> JSONResponse:
    detail = {"fields": exc.fields} if exc.fields else None
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": detail},
    )


def _visibility_response(exc: VisibilityError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": None},
    )


def _parse_user_id(user: UserContext) -> uuid.UUID | None:
    try:
        return uuid.UUID(user.id)
    except ValueError:
        return None


@router.post(
    "/translate",
    response_model=TranslateResponse,
    summary="Translate visual query config to parameterized SQL (QUERY-008)",
    responses={
        422: {"description": "QUERY_TRANSLATE_* — invalid config, unknown field, unsupported dialect"},
    },
)
def translate_query(
    payload: TranslateRequest,
    _: Annotated[UserContext, Depends(require_permission(PERM_DS_READ))],
) -> TranslateResponse | JSONResponse:
    try:
        return translator_service.translate_config_to_sql(payload)
    except TranslateError as exc:
        return _translate_error(exc)


@router.post(
    "/execute",
    response_model=ExecuteResponse,
    summary="Execute read-only query (IF-06)",
    responses={
        400: {"description": "QUERY_NOT_READONLY — mutating SQL rejected"},
        403: {"description": "Data source not visible to caller"},
    },
)
def execute_query(
    payload: ExecuteRequest,
    user: Annotated[UserContext, Depends(require_permission(PERM_DS_READ))],
    db: Annotated[Session, Depends(_db)],
) -> ExecuteResponse | JSONResponse:
    try:
        return query_service.execute_query(db, user, payload)
    except QueryError as exc:
        return _error_response(exc)


@router.get("/bindings", response_model=BindingListResponse)
def list_bindings(
    user: Annotated[UserContext, Depends(require_permission(PERM_DATASET_READ))],
    db: Annotated[Session, Depends(_db)],
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    data_source_id: uuid.UUID | None = Query(default=None, alias="dataSourceId"),
) -> BindingListResponse | JSONResponse:
    try:
        return binding_service.list_bindings(
            db, user.roles, is_root=user.is_root, limit=limit, offset=offset, data_source_id=data_source_id,
        )
    except QueryError as exc:
        return _error_response(exc)
    except VisibilityError as exc:
        return _visibility_response(exc)


@router.post("/bindings", response_model=BindingOut, status_code=status.HTTP_201_CREATED)
def create_binding(
    payload: BindingCreate,
    user: Annotated[UserContext, Depends(require_permission(PERM_DATASET_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> BindingOut | JSONResponse:
    try:
        return binding_service.create_binding(
            db, user.roles, payload, created_by=_parse_user_id(user), is_root=user.is_root,
        )
    except QueryError as exc:
        return _error_response(exc)
    except VisibilityError as exc:
        return _visibility_response(exc)


@router.get("/bindings/{binding_id}", response_model=BindingOut)
def get_binding(
    binding_id: uuid.UUID,
    user: Annotated[UserContext, Depends(require_permission(PERM_DATASET_READ))],
    db: Annotated[Session, Depends(_db)],
) -> BindingOut | JSONResponse:
    try:
        return binding_service.get_binding(db, user.roles, binding_id, is_root=user.is_root)
    except QueryError as exc:
        return _error_response(exc)


@router.put("/bindings/{binding_id}", response_model=BindingOut)
def update_binding(
    binding_id: uuid.UUID,
    payload: BindingUpdate,
    user: Annotated[UserContext, Depends(require_permission(PERM_DATASET_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> BindingOut | JSONResponse:
    try:
        return binding_service.update_binding(db, user.roles, binding_id, payload, is_root=user.is_root)
    except QueryError as exc:
        return _error_response(exc)
    except VisibilityError as exc:
        return _visibility_response(exc)


@router.delete("/bindings/{binding_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_binding(
    binding_id: uuid.UUID,
    user: Annotated[UserContext, Depends(require_permission(PERM_DATASET_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> Response:
    try:
        binding_service.delete_binding(db, user.roles, binding_id, is_root=user.is_root)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except QueryError as exc:
        return _error_response(exc)


@router.get("/routing/modes", response_model=RoutingModesOut)
def get_routing_modes(
    _: Annotated[UserContext, Depends(require_permission(PERM_DATASET_READ))],
) -> RoutingModesOut:
    return list_routing_modes()


@router.post("/native/validate", response_model=NativeValidateOut)
def validate_native_query(
    payload: NativeQuerySpec,
    _: Annotated[UserContext, Depends(require_permission(PERM_DS_READ))],
) -> NativeValidateOut | JSONResponse:
    try:
        return validate_native_spec(payload)
    except QueryError as exc:
        return _error_response(exc)


@router.post("/readonly-guard", response_model=ReadonlyGuardOut)
def readonly_route_guard(
    payload: ReadonlyGuardIn,
    _: Annotated[UserContext, Depends(require_permission(PERM_DS_READ))],
) -> ReadonlyGuardOut | JSONResponse:
    try:
        return assert_readonly_route_guard(payload)
    except QueryError as exc:
        return _error_response(exc)


@router.get("/dataset/routing", response_model=DatasetRoutingOut)
def get_dataset_routing(
    _: Annotated[UserContext, Depends(require_permission(PERM_DATASET_READ))],
) -> DatasetRoutingOut:
    return dataset_routing_doc()


@router.post("/dataset/validate", response_model=None)
def validate_dataset_query(
    payload: dict,
    user: Annotated[UserContext, Depends(require_permission(PERM_DATASET_READ))],
    db: Annotated[Session, Depends(_db)],
):
    try:
        return validate_dataset_spec(payload, user.roles, session=db)
    except QueryError as exc:
        return _error_response(exc)


@router.post("/dataset/execute-plan", response_model=DatasetExecutePlanOut)
def post_dataset_execute_plan(
    payload: dict,
    user: Annotated[UserContext, Depends(require_permission(PERM_DATASET_READ))],
    db: Annotated[Session, Depends(_db)],
):
    try:
        return build_dataset_execute_plan(db, user, payload)
    except QueryError as exc:
        return _error_response(exc)


@router.post(
    "/dataset/execute",
    response_model=DatasetExecuteResponse,
    summary="Execute dataset query from stored config (QUERY-009)",
)
def execute_dataset_config(
    payload: DatasetExecuteRequest,
    user: Annotated[UserContext, Depends(require_permission(PERM_DATASET_READ))],
    db: Annotated[Session, Depends(_db)],
) -> DatasetExecuteResponse | JSONResponse:
    try:
        return execute_dataset_from_config(db, user, payload)
    except QueryError as exc:
        return _error_response(exc)
