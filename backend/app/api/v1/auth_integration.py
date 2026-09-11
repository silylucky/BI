from __future__ import annotations

import uuid
import uuid as uuid_mod
from typing import Annotated

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth.deps import UserContext, require_permission
from app.auth.login import oidc as oidc_service
from app.auth.models import get_meta_session
from app.auth.schemas_phase_c import AuthIntegrationStatusOut

router = APIRouter(prefix="/auth-integration", tags=["auth"])

PERM_PLATFORM_READ = "system:platform_connect.read"


class OidcCallbackIn(BaseModel):
    provider: str = Field(min_length=1, max_length=64)
    code: str = Field(min_length=1)
    state: str | None = None


def _db() -> Session:
    session = get_meta_session()
    try:
        yield session
    finally:
        session.close()


@router.get("/status", response_model=AuthIntegrationStatusOut)
def auth_integration_status(
    _: Annotated[UserContext, Depends(require_permission(PERM_PLATFORM_READ))],
) -> AuthIntegrationStatusOut:
    return AuthIntegrationStatusOut(ldap_enabled=False, oidc_enabled=False, spec_ready=True)


@router.post("/oidc/callback")
def oidc_callback(
    payload: OidcCallbackIn,
    db: Annotated[Session, Depends(_db)],
) -> JSONResponse:
    """OIDC 回调占位（公开路径须后续在 middleware 登记）。"""
    try:
        result = oidc_service.handle_oidc_callback(
            db,
            provider=payload.provider,
            code=payload.code,
            state=payload.state,
        )
    except oidc_service.LoginError as exc:
        return JSONResponse(
            status_code=exc.status,
            content={"code": exc.code, "message": exc.message, "detail": None},
        )
    return JSONResponse(
        content={
            "userId": str(result.user_id),
            "username": result.username,
            "provider": result.provider,
            "subject": result.subject,
        }
    )
