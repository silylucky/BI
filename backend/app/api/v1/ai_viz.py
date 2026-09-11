from __future__ import annotations

import uuid
from typing import Annotated, Generator

from fastapi import APIRouter, Depends, Query, Response, status
from fastapi.responses import HTMLResponse, JSONResponse
from sqlalchemy.orm import Session

from app.ai_viz import service as ai_viz_service
from app.ai_viz.errors import AiVizError
from app.ai_viz.schemas import (
    AiVizArtifactBundleOut,
    AiVizArtifactCreateIn,
    AiVizArtifactDeleteOut,
    AiVizArtifactListOut,
    AiVizArtifactOut,
    AiVizArtifactReferencesOut,
)
from app.auth.deps import UserContext, require_permission
from app.datasources.models import get_meta_session

PERM_READ = "dashboard:read"
PERM_EDIT = "dashboard:edit"

router = APIRouter(prefix="/ai-viz", tags=["ai-viz"])


def _db() -> Generator[Session, None, None]:
    session = get_meta_session()
    try:
        yield session
    finally:
        session.close()


def _error_response(exc: AiVizError) -> JSONResponse:
    detail = {"fields": exc.fields} if exc.fields else None
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": detail},
    )


@router.post("/artifacts", status_code=status.HTTP_201_CREATED, response_model=AiVizArtifactOut)
def create_artifact(
    payload: AiVizArtifactCreateIn,
    user: Annotated[UserContext, Depends(require_permission(PERM_EDIT))],
    db: Annotated[Session, Depends(_db)],
) -> AiVizArtifactOut | JSONResponse:
    try:
        return ai_viz_service.create_artifact(db, payload, user)
    except AiVizError as exc:
        return _error_response(exc)


@router.put("/artifacts/{artifact_id}", response_model=AiVizArtifactOut)
def update_artifact(
    artifact_id: uuid.UUID,
    payload: AiVizArtifactCreateIn,
    user: Annotated[UserContext, Depends(require_permission(PERM_EDIT))],
    db: Annotated[Session, Depends(_db)],
) -> AiVizArtifactOut | JSONResponse:
    try:
        return ai_viz_service.update_artifact(db, artifact_id, payload, user)
    except AiVizError as exc:
        return _error_response(exc)


@router.get("/artifacts", response_model=AiVizArtifactListOut)
def list_artifacts(
    user: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> AiVizArtifactListOut | JSONResponse:
    try:
        items = ai_viz_service.list_artifacts(db, user, limit=limit, offset=offset)
        return AiVizArtifactListOut(items=items)
    except AiVizError as exc:
        return _error_response(exc)


@router.delete("/artifacts/{artifact_id}", response_model=None)
def delete_artifact(
    artifact_id: uuid.UUID,
    user: Annotated[UserContext, Depends(require_permission(PERM_EDIT))],
    db: Annotated[Session, Depends(_db)],
    unlink: Annotated[
        bool,
        Query(description="为 true 时先从引用看板/大屏 layout 移除 widget，再删组件库记录"),
    ] = False,
) -> AiVizArtifactDeleteOut | Response | JSONResponse:
    try:
        result = ai_viz_service.delete_artifact(db, artifact_id, user, unlink=unlink)
        if result is not None:
            return result
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except AiVizError as exc:
        return _error_response(exc)


@router.get("/artifacts/{artifact_id}", response_model=AiVizArtifactOut)
def get_artifact_meta(
    artifact_id: uuid.UUID,
    user: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
) -> AiVizArtifactOut | JSONResponse:
    try:
        row = ai_viz_service.get_artifact(db, artifact_id, user)
        return ai_viz_service.to_artifact_out(row)
    except AiVizError as exc:
        return _error_response(exc)


@router.get("/artifacts/{artifact_id}/bundle", response_model=AiVizArtifactBundleOut)
def get_artifact_bundle(
    artifact_id: uuid.UUID,
    user: Annotated[UserContext, Depends(require_permission(PERM_EDIT))],
    db: Annotated[Session, Depends(_db)],
) -> AiVizArtifactBundleOut | JSONResponse:
    try:
        return ai_viz_service.get_artifact_bundle(db, artifact_id, user)
    except AiVizError as exc:
        return _error_response(exc)


@router.get("/artifacts/{artifact_id}/refs", response_model=AiVizArtifactReferencesOut)
def get_artifact_references(
    artifact_id: uuid.UUID,
    user: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
) -> AiVizArtifactReferencesOut | JSONResponse:
    try:
        return ai_viz_service.get_artifact_references(db, artifact_id, user)
    except AiVizError as exc:
        return _error_response(exc)


@router.get("/artifacts/{artifact_id}/entry", response_model=None)
def get_artifact_entry(
    artifact_id: uuid.UUID,
    user: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
):
    try:
        html = ai_viz_service.get_entry_html(db, artifact_id, user)
        return HTMLResponse(
            content=html,
            headers={"X-Content-Type-Options": "nosniff"},
        )
    except AiVizError as exc:
        return _error_response(exc)
