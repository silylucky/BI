from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.auth.audit import service as audit_service
from app.auth.deps import UserContext, require_permission
from app.auth.models import get_meta_session
from app.auth.schemas import AuditEventOut, AuditListResponse

router = APIRouter(prefix="/audit", tags=["auth"])


def _db() -> Session:
    session = get_meta_session()
    try:
        yield session
    finally:
        session.close()


@router.get("/events", response_model=AuditListResponse)
def list_audit_events(
    _actor: Annotated[UserContext, Depends(require_permission("system:audit.read"))],
    db: Annotated[Session, Depends(_db)],
    target_id: uuid.UUID | None = None,
    action: str | None = None,
    target_type: str | None = None,
    actor_id: str | None = None,
    created_after: datetime | None = None,
    created_before: datetime | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> AuditListResponse | JSONResponse:
    if created_after is not None and created_before is not None:
        if created_after >= created_before:
            return JSONResponse(
                status_code=422,
                content={
                    "code": "AUDIT_RANGE_INVALID",
                    "message": "created_after must be before created_before",
                    "detail": None,
                },
            )
    items, total = audit_service.list_events(
        db,
        target_id=target_id,
        action=action,
        target_type=target_type,
        actor_id=actor_id,
        created_after=created_after,
        created_before=created_before,
        limit=limit,
        offset=offset,
    )
    return AuditListResponse(
        items=[AuditEventOut.model_validate(e) for e in items],
        total=total,
    )
