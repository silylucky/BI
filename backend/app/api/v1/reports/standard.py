"""Standard analysis API routes."""

from __future__ import annotations

import uuid
from collections.abc import Generator
from typing import Annotated

from fastapi import APIRouter, Depends, Response
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.auth.deps import UserContext, require_permission
from app.datasources.models import get_meta_session
from app.reports.standard.compare import compare_pack, compare_periods_matrix
from app.reports.standard.errors import StandardAnalysisError
from app.reports.standard.schemas import (
    AnalysisPackIn,
    AnalysisPackListResponse,
    AnalysisPackOut,
    CapabilitiesOut,
    CompareMatrixOut,
    CompareOut,
    RunIn,
    RunOut,
    SnapshotListResponse,
    SnapshotOut,
)
from app.reports.standard.snapshot import capture_snapshot, list_snapshots
from app.reports.standard import service as standard_service

router = APIRouter(prefix="/standard", tags=["reports-standard"])

PERM_READ = "report:read"
PERM_MANAGE = "report:manage"


def _std_error(exc: StandardAnalysisError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": exc.detail},
    )


def _db() -> Generator[Session, None, None]:
    session = get_meta_session()
    try:
        yield session
    finally:
        session.close()


@router.get("/packs", response_model=AnalysisPackListResponse)
def list_packs(actor: Annotated[UserContext, Depends(require_permission(PERM_READ))]) -> AnalysisPackListResponse:
    return standard_service.list_packs(actor)


@router.get("/packs/{pack_key}", response_model=AnalysisPackOut)
def get_pack(
    pack_key: str,
    actor: Annotated[UserContext, Depends(require_permission(PERM_READ))],
) -> AnalysisPackOut | JSONResponse:
    try:
        return standard_service.get_pack(pack_key, actor)
    except StandardAnalysisError as exc:
        return _std_error(exc)


@router.put("/packs/{pack_key}", response_model=AnalysisPackOut)
def upsert_pack(
    pack_key: str,
    payload: AnalysisPackIn,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
) -> AnalysisPackOut | JSONResponse:
    try:
        return standard_service.upsert_pack(pack_key, payload, actor)
    except StandardAnalysisError as exc:
        return _std_error(exc)


@router.delete("/packs/{pack_key}", status_code=204, response_model=None)
def delete_pack(
    pack_key: str,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
) -> Response | JSONResponse:
    try:
        standard_service.delete_pack(pack_key, actor)
        return Response(status_code=204)
    except StandardAnalysisError as exc:
        return _std_error(exc)


@router.get("/packs/{pack_key}/capabilities", response_model=CapabilitiesOut)
def pack_capabilities(
    pack_key: str,
    actor: Annotated[UserContext, Depends(require_permission(PERM_READ))],
) -> CapabilitiesOut | JSONResponse:
    try:
        return standard_service.get_capabilities(pack_key, actor)
    except StandardAnalysisError as exc:
        return _std_error(exc)


@router.post("/packs/{pack_key}/run", response_model=RunOut)
def run_pack(
    pack_key: str,
    payload: RunIn,
    actor: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
) -> RunOut | JSONResponse:
    try:
        return standard_service.run_pack(db, pack_key, payload, actor)
    except StandardAnalysisError as exc:
        return _std_error(exc)


@router.post("/packs/{pack_key}/snapshots/capture", response_model=SnapshotOut)
def capture(
    pack_key: str,
    theme: str,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
    period_key: str | None = None,
) -> SnapshotOut | JSONResponse:
    try:
        pack = standard_service.get_pack(pack_key, actor)
        if period_key:
            period_kind, _ = standard_service.period_key_for(pack.snapshot_cron_preset)
            return capture_snapshot(
                db, pack_key, theme, actor, period_kind=period_kind, period_key=period_key,
            )
        return capture_snapshot(db, pack_key, theme, actor)
    except StandardAnalysisError as exc:
        return _std_error(exc)


@router.get("/packs/{pack_key}/snapshots", response_model=SnapshotListResponse)
def snapshots(
    pack_key: str,
    actor: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    theme: str | None = None,
) -> SnapshotListResponse | JSONResponse:
    try:
        return list_snapshots(pack_key, theme, actor)
    except StandardAnalysisError as exc:
        return _std_error(exc)


@router.get("/packs/{pack_key}/compare", response_model=CompareOut)
def compare(
    pack_key: str,
    theme: str,
    actor: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
    baseline_period_key: str | None = None,
    current_period_key: str | None = None,
) -> CompareOut | JSONResponse:
    try:
        return compare_pack(
            db,
            pack_key,
            theme,
            actor,
            baseline_period_key=baseline_period_key,
            current_period_key=current_period_key,
        )
    except StandardAnalysisError as exc:
        return _std_error(exc)


@router.get("/packs/{pack_key}/compare/matrix", response_model=CompareMatrixOut)
def compare_matrix(
    pack_key: str,
    theme: str,
    period_keys: str,
    actor: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
) -> CompareMatrixOut | JSONResponse:
    try:
        keys = [part.strip() for part in period_keys.split(",") if part.strip()]
        return compare_periods_matrix(db, pack_key, theme, keys, actor)
    except StandardAnalysisError as exc:
        return _std_error(exc)
