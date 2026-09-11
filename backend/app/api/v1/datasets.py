from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse, Response

from app.auth.deps import UserContext, require_permission

PERM_READ = "dataset:read"
PERM_MANAGE = "dataset:manage"
from app.metadata.dataset.errors import DatasetError
from app.metadata.dataset.schemas import (
    DatasetBindConfigIn,
    DatasetItemIn,
    DatasetItemOut,
    DatasetListResponse,
    DatasetTransformRulesIn,
    DatasetTransformRulesOut,
    DatasetValidateOut,
)
from app.metadata.dataset import service as dataset_service
from app.metadata.dataset import transform_rules as dataset_transform_rules

router = APIRouter(prefix="/datasets", tags=["metadata", "META-004"])


def _dataset_error(exc: DatasetError) -> JSONResponse:
    detail = {"fields": exc.fields} if exc.fields else None
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": detail},
    )


@router.get("", response_model=DatasetListResponse)
def list_datasets(
    actor: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    q: str | None = Query(default=None),
) -> DatasetListResponse:
    return dataset_service.list_datasets(limit, offset, actor, q=q)


@router.post("", response_model=DatasetItemOut, status_code=status.HTTP_201_CREATED)
def create_dataset(
    payload: DatasetItemIn,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
) -> DatasetItemOut | JSONResponse:
    try:
        return dataset_service.create_dataset(payload, actor)
    except DatasetError as exc:
        return _dataset_error(exc)


@router.get("/{dataset_id}", response_model=DatasetItemOut)
def get_dataset(
    dataset_id: str,
    actor: Annotated[UserContext, Depends(require_permission(PERM_READ))],
) -> DatasetItemOut | JSONResponse:
    try:
        return dataset_service.get_dataset(dataset_id, actor)
    except DatasetError as exc:
        return _dataset_error(exc)


@router.post("/validate", response_model=DatasetValidateOut)
def validate_dataset(
    payload: DatasetItemIn,
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
) -> DatasetValidateOut | JSONResponse:
    try:
        return dataset_service.validate_dataset_draft(payload)
    except DatasetError as exc:
        return _dataset_error(exc)


@router.put("/{dataset_id}", response_model=DatasetItemOut)
def update_dataset(
    dataset_id: str,
    payload: DatasetItemIn,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
) -> DatasetItemOut | JSONResponse:
    try:
        return dataset_service.update_dataset(dataset_id, payload, actor)
    except DatasetError as exc:
        return _dataset_error(exc)


@router.delete("/{dataset_id}", response_model=None)
def delete_dataset(
    dataset_id: str,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
) -> Response | JSONResponse:
    try:
        dataset_service.delete_dataset(dataset_id, actor)
        from app.auth.audit.write_hooks import record_domain_delete
        from app.core.db.meta import get_meta_session

        target_id = uuid.uuid5(uuid.NAMESPACE_URL, f"dataset:{dataset_id}")
        db = get_meta_session()
        try:
            record_domain_delete(
                db,
                actor_id=actor.id,
                actor_username=actor.username,
                target_type="dataset",
                target_id=target_id,
                detail={"datasetId": dataset_id},
            )
            db.commit()
        finally:
            db.close()
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except DatasetError as exc:
        return _dataset_error(exc)


@router.post("/{dataset_id}/bind-query-config", response_model=DatasetItemOut)
def bind_query_config(
    dataset_id: str,
    payload: DatasetBindConfigIn,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
) -> DatasetItemOut | JSONResponse:
    try:
        return dataset_service.bind_query_config(dataset_id, payload.config_id, actor)
    except DatasetError as exc:
        return _dataset_error(exc)


@router.get("/{dataset_id}/transform-rules", response_model=DatasetTransformRulesOut)
def get_transform_rules(
    dataset_id: str,
    actor: Annotated[UserContext, Depends(require_permission(PERM_READ))],
) -> DatasetTransformRulesOut | JSONResponse:
    try:
        return dataset_transform_rules.get_transform_rules(dataset_id, actor)
    except DatasetError as exc:
        return _dataset_error(exc)


@router.put("/{dataset_id}/transform-rules", response_model=DatasetTransformRulesOut)
def put_transform_rules(
    dataset_id: str,
    payload: DatasetTransformRulesIn,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
) -> DatasetTransformRulesOut | JSONResponse:
    try:
        return dataset_transform_rules.put_transform_rules(dataset_id, payload.rules, actor)
    except DatasetError as exc:
        return _dataset_error(exc)


@router.post("/{dataset_id}/transform-rules/auto-align", response_model=DatasetTransformRulesOut)
def auto_align_transform_rules(
    dataset_id: str,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
) -> DatasetTransformRulesOut | JSONResponse:
    try:
        return dataset_transform_rules.auto_align_transform_rules(dataset_id, actor)
    except DatasetError as exc:
        return _dataset_error(exc)
