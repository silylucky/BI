from __future__ import annotations

import uuid
import uuid as uuid_mod
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse, Response
from sqlalchemy.orm import Session

from app.auth.deps import UserContext, require_permission
from app.auth.masking import service as mask_service
from app.auth.models import get_meta_session
from app.auth.schemas_phase_c import ColumnMaskCreate, ColumnMaskListResponse, ColumnMaskOut
from app.core.logging import trace_id_var

router = APIRouter(prefix="/column-masks", tags=["auth"])

PERM_MASK_MANAGE = "dataset:mask.manage"


def _db() -> Session:
    session = get_meta_session()
    try:
        yield session
    finally:
        session.close()


def _audit_context(actor: UserContext) -> dict[str, str | None]:
    trace = trace_id_var.get() or uuid_mod.uuid4().hex
    return {"actor_id": actor.id, "actor_username": actor.username, "trace_id": trace}


def _mask_error(exc: mask_service.MaskError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": None},
    )


@router.get("", response_model=ColumnMaskListResponse)
def list_column_masks(
    _: Annotated[UserContext, Depends(require_permission(PERM_MASK_MANAGE))],
    db: Annotated[Session, Depends(_db)],
    datasource_id: uuid.UUID | None = Query(default=None, alias="datasourceId"),
    dataset_id: str | None = Query(default=None, alias="datasetId"),
    table_name: str | None = Query(default=None, alias="tableName"),
) -> ColumnMaskListResponse:
    items = [
        ColumnMaskOut.model_validate(row)
        for row in mask_service.list_masks(
            db, datasource_id=datasource_id, dataset_id=dataset_id, table_name=table_name
        )
    ]
    return ColumnMaskListResponse(items=items)


@router.post("", response_model=ColumnMaskOut, status_code=status.HTTP_201_CREATED)
def create_column_mask(
    payload: ColumnMaskCreate,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MASK_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> ColumnMaskOut | JSONResponse:
    try:
        row = mask_service.create_mask(
            db,
            datasource_id=payload.datasource_id,
            dataset_id=payload.dataset_id,
            table_name=payload.table_name,
            column_name=payload.column_name,
            mask_strategy=payload.mask_strategy,
            **_audit_context(actor),
        )
    except mask_service.MaskError as exc:
        return _mask_error(exc)
    return ColumnMaskOut.model_validate(row)


@router.delete("/{mask_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_column_mask(
    mask_id: uuid.UUID,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MASK_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> Response | JSONResponse:
    try:
        mask_service.delete_mask(db, mask_id, **_audit_context(actor))
    except mask_service.MaskError as exc:
        return _mask_error(exc)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
