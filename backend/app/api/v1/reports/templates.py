from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status
from fastapi.responses import JSONResponse

from app.auth.deps import UserContext, require_permission

PERM_READ = "report:read"
PERM_MANAGE = "report:manage"
from app.reports.templates.errors import TemplateDefError
from app.reports.templates.schemas import (
    TemplateDefinitionIn,
    TemplateDefinitionOut,
    TemplateListOut,
    TemplateValidateOut,
)
from app.reports.templates import service as template_service

router = APIRouter(prefix="/templates", tags=["reports-templates"])


def _template_error(exc: TemplateDefError) -> JSONResponse:
    detail = {"fields": exc.fields} if exc.fields else None
    return JSONResponse(status_code=exc.status, content={"code": exc.code, "message": exc.message, "detail": detail})


@router.post("/validate", response_model=TemplateValidateOut)
def validate_template(
    payload: TemplateDefinitionIn,
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
) -> TemplateValidateOut | JSONResponse:
    try:
        return template_service.validate_template_definition(payload)
    except TemplateDefError as exc:
        return _template_error(exc)


@router.get("", response_model=TemplateListOut)
def list_templates(
    actor: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    prefix: str | None = Query(default=None, max_length=64),
) -> TemplateListOut | JSONResponse:
    try:
        return TemplateListOut(items=template_service.list_template_definitions(actor, prefix))
    except TemplateDefError as exc:
        return _template_error(exc)


@router.delete("/{template_key}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_template(
    template_key: str,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
) -> Response | JSONResponse:
    try:
        template_service.delete_template_definition(template_key, actor)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except TemplateDefError as exc:
        return _template_error(exc)


@router.put("/{template_key}", response_model=TemplateDefinitionOut)
def upsert_template(
    template_key: str,
    payload: TemplateDefinitionIn,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
) -> TemplateDefinitionOut | JSONResponse:
    try:
        return template_service.upsert_template_definition(template_key, payload, actor)
    except TemplateDefError as exc:
        return _template_error(exc)


@router.get("/{template_key}/versions", response_model=None)
def list_template_versions(
    template_key: str,
    actor: Annotated[UserContext, Depends(require_permission(PERM_READ))],
):
    from app.reports.templates import acl, versions as template_versions

    try:
        acl.assert_template_read_access(actor, template_key)
        return template_versions.list_versions(template_key)
    except TemplateDefError as exc:
        return _template_error(exc)


@router.post("/{template_key}/publish", response_model=None)
def publish_template(
    template_key: str,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    change_note: str | None = Query(default=None, alias="changeNote"),
):
    from app.reports import service as report_service
    from app.reports.templates import acl

    try:
        acl.assert_template_write_access(actor, template_key)
        result = report_service.publish_template(template_key, actor, change_note=change_note)
        from app.auth.audit.write_hooks import record_domain_publish
        from app.core.db.meta import get_meta_session

        db = get_meta_session()
        try:
            record_domain_publish(
                db,
                actor_id=actor.id,
                actor_username=actor.username,
                target_type="report",
                target_id=uuid.uuid5(uuid.NAMESPACE_URL, f"report-template:{template_key}"),
                detail={"templateKey": template_key},
            )
            db.commit()
        finally:
            db.close()
        return result
    except TemplateDefError as exc:
        return _template_error(exc)


@router.get("/{template_key}", response_model=TemplateDefinitionOut)
def get_template(
    template_key: str,
    actor: Annotated[UserContext, Depends(require_permission(PERM_READ))],
) -> TemplateDefinitionOut | JSONResponse:
    try:
        return template_service.get_template_definition(template_key, actor)
    except TemplateDefError as exc:
        return _template_error(exc)
