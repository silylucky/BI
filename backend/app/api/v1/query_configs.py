from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.auth.deps import UserContext, require_permission
from app.auth.permissions import permission_matches

PERM_READ = "dataset:read"
PERM_MANAGE = "dataset:manage"
from app.datasources.models import get_meta_session
from app.query.config_store import service as config_service
from app.query.config_store.access import assert_config_readable
from app.query.config_store.schemas import ConfigError, ConfigListResponse, ConfigOut, ConfigUpsert
from app.query.translator.from_config import translate_from_config_record
from app.query.translator.schemas import TranslateError, TranslateResponse

router = APIRouter(prefix="/query/configs", tags=["query", "QUERY-007"])


def _owner_uuid(actor: UserContext) -> uuid.UUID | None:
    try:
        return uuid.UUID(actor.id)
    except ValueError:
        return None


def _db() -> Session:
    session = get_meta_session()
    try:
        yield session
    finally:
        session.close()


def _config_error(exc: ConfigError) -> JSONResponse:
    detail = {"fields": exc.fields} if exc.fields else None
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": detail},
    )


def _translate_error(exc: TranslateError) -> JSONResponse:
    detail = {"fields": exc.fields} if exc.fields else None
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": detail},
    )


@router.put("", response_model=ConfigOut)
def upsert_query_config(
    payload: ConfigUpsert,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> ConfigOut | JSONResponse:
    try:
        record = config_service.upsert_config(db, payload, owner_id=_owner_uuid(actor))
    except ConfigError as exc:
        return _config_error(exc)
    except ValidationError as exc:
        return JSONResponse(
            status_code=422,
            content={
                "code": "CONFIG_INVALID_PAYLOAD",
                "message": "Invalid config payload",
                "detail": {
                    "fields": [
                        {"field": ".".join(str(x) for x in e["loc"]), "message": e["msg"]}
                        for e in exc.errors()
                    ]
                },
            },
        )
    return ConfigOut.model_validate(record)


@router.get("", response_model=ConfigListResponse)
def list_query_configs(
    actor: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
    config_type: str | None = None,
    ref_type: str | None = None,
    ref_id: uuid.UUID | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> ConfigListResponse:
    items, total = config_service.list_configs(
        db,
        config_type,
        ref_type,
        ref_id,
        limit,
        offset,
        actor_id=_owner_uuid(actor),
        is_admin=permission_matches(set(actor.permissions), PERM_MANAGE, actor.is_root),
    )
    return ConfigListResponse(items=[ConfigOut.model_validate(r) for r in items], total=total)


@router.get("/{config_id}", response_model=ConfigOut)
def get_query_config(
    config_id: uuid.UUID,
    actor: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
) -> ConfigOut | JSONResponse:
    try:
        record = config_service.get_config_by_id(db, config_id)
        assert_config_readable(actor, record)
    except ConfigError as exc:
        return _config_error(exc)
    return ConfigOut.model_validate(record)


@router.post("/{config_id}/translate", response_model=TranslateResponse)
def translate_query_config(
    config_id: uuid.UUID,
    actor: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
) -> TranslateResponse | JSONResponse:
    try:
        record = config_service.get_config_by_id(db, config_id)
        assert_config_readable(actor, record)
        return translate_from_config_record(record)
    except ConfigError as exc:
        return _config_error(exc)
    except TranslateError as exc:
        return _translate_error(exc)
