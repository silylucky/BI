from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.auth.deps import UserContext, get_current_user, require_permission
from app.datasources.models import get_meta_session
from app.viz.tile_services import service as tile_service
from app.viz.tile_services.schemas import (
    TileServiceCreate,
    TileServiceListResponse,
    TileServiceOut,
    TileServicePatch,
    TileServiceResolveOut,
)

PERM_READ = "datasource:read"
PERM_MANAGE = "datasource:manage"

router = APIRouter(prefix="/tile-services", tags=["tile-services"])


def _db() -> Session:
    session = get_meta_session()
    try:
        yield session
    finally:
        session.close()


def _error_response(exc: tile_service.TileServiceError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": None},
    )


@router.get("", response_model=TileServiceListResponse)
def list_tile_services(
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
) -> TileServiceListResponse:
    return tile_service.list_tile_services(db)


@router.get("/{service_id}/resolve", response_model=TileServiceResolveOut)
def resolve_tile_service(
    service_id: str,
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> TileServiceResolveOut | JSONResponse:
    try:
        return tile_service.resolve_tile_service(db, service_id)
    except tile_service.TileServiceError as exc:
        return _error_response(exc)


@router.get("/{service_id}", response_model=TileServiceOut)
def get_tile_service(
    service_id: str,
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
) -> TileServiceOut | JSONResponse:
    try:
        return tile_service.get_tile_service(db, service_id)
    except tile_service.TileServiceError as exc:
        return _error_response(exc)


@router.post(
    "",
    response_model=TileServiceOut,
    status_code=status.HTTP_201_CREATED,
)
def create_tile_service(
    payload: TileServiceCreate,
    user: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> TileServiceOut | JSONResponse:
    try:
        return tile_service.create_tile_service(db, payload, updated_by=user.id)
    except tile_service.TileServiceError as exc:
        return _error_response(exc)


@router.patch("/{service_id}", response_model=TileServiceOut)
def patch_tile_service(
    service_id: str,
    payload: TileServicePatch,
    user: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> TileServiceOut | JSONResponse:
    try:
        return tile_service.patch_tile_service(db, service_id, payload, updated_by=user.id)
    except tile_service.TileServiceError as exc:
        return _error_response(exc)
