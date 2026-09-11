from __future__ import annotations

import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy.orm import Session

from app.auth.deps import UserContext, require_permission

PERM_READ = "dashboard:read"
PERM_EDIT = "dashboard:edit"
from app.datasources.models import get_meta_session
from app.designer import snapshot as snapshot_service
from app.designer import service as designer_service
from app.designer.schemas import ComputeRulesConfig, DesignerError, DesignerSubmitWorkflowIn, DesignerSubmitWorkflowOut, FieldRegistryOut, OutputFieldsConfig, PreviewTranslateIn, QueryConditionsConfig, SqlModeSpec
from app.designer import output_fields as output_fields_service
from app.designer import sql_mode as sql_mode_service
from app.designer import workflow as workflow_link_service
from app.designer.workflow import DesignerWorkflowLinkIn, DesignerWorkflowLinkOut, DesignerWorkflowLinkValidateOut
from app.query.config_store import service as config_store_service
from app.query.config_store.access import assert_config_readable
from app.query.config_store.schemas import ConfigError

router = APIRouter(
    prefix="/designer",
    tags=["designer", "DESIGN-001", "DESIGN-002", "DESIGN-003", "DESIGN-005"],
)


def _db() -> Session:
    session = get_meta_session()
    try:
        yield session
    finally:
        session.close()


def _owner_uuid(actor: UserContext) -> uuid.UUID | None:
    try:
        return uuid.UUID(actor.id)
    except ValueError:
        return None


def _designer_error(exc: DesignerError) -> JSONResponse:
    detail: dict[str, object] = {}
    if exc.fields:
        detail["fields"] = exc.fields
    if exc.remediation:
        detail["remediation"] = exc.remediation
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": detail or None},
    )


def _config_error(exc: ConfigError) -> JSONResponse:
    detail = {"fields": exc.fields} if exc.fields else None
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": detail},
    )


class DesignModeIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    ref_id: uuid.UUID = Field(alias="refId")
    mode: Literal["visual", "sql"]


@router.post("/conditions/validate", response_model=QueryConditionsConfig)
def validate_conditions(
    payload: QueryConditionsConfig,
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
) -> QueryConditionsConfig | JSONResponse:
    try:
        return designer_service.validate_conditions_config(payload)
    except DesignerError as exc:
        return _designer_error(exc)


@router.put("/conditions", response_model=QueryConditionsConfig)
def save_conditions(
    payload: QueryConditionsConfig,
    actor: Annotated[UserContext, Depends(require_permission(PERM_EDIT))],
    db: Annotated[Session, Depends(_db)],
) -> QueryConditionsConfig | JSONResponse:
    try:
        try:
            existing = config_store_service.get_config_by_ref(
                db, "query_conditions", payload.ref_type, payload.ref_id
            )
            assert_config_readable(actor, existing)
        except ConfigError as exc:
            if exc.code != "CONFIG_NOT_FOUND":
                return _config_error(exc)
        config, _ = designer_service.save_conditions(db, payload, _owner_uuid(actor))
        return config
    except ConfigError as exc:
        return _config_error(exc)
    except DesignerError as exc:
        return _designer_error(exc)
    except ValidationError as exc:
        return JSONResponse(
            status_code=422,
            content={
                "code": "DESIGN_INVALID_CONDITIONS",
                "message": "Invalid conditions payload",
                "detail": {
                    "fields": [
                        {"field": ".".join(str(x) for x in e["loc"]), "message": e["msg"]}
                        for e in exc.errors()
                    ]
                },
            },
        )


@router.get("/conditions", response_model=QueryConditionsConfig)
def get_conditions(
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
    ref_type: str = "design_draft",
    ref_id: uuid.UUID | None = Query(default=None, alias="ref_id"),
    ref_id_camel: uuid.UUID | None = Query(default=None, alias="refId"),
) -> QueryConditionsConfig | JSONResponse:
    resolved_ref = ref_id if ref_id is not None else ref_id_camel
    if resolved_ref is None:
        return JSONResponse(
            status_code=422,
            content={
                "code": "DESIGN_MISSING_REF",
                "message": "ref_id is required",
                "detail": None,
            },
        )
    try:
        return designer_service.get_conditions(db, ref_type, resolved_ref)
    except Exception as exc:
        from app.query.config_store.schemas import ConfigError

        if isinstance(exc, ConfigError):
            return JSONResponse(
                status_code=exc.status,
                content={"code": exc.code, "message": exc.message, "detail": None},
            )
        if isinstance(exc, DesignerError):
            return _designer_error(exc)
        raise


@router.post("/sql-mode/validate", response_model=SqlModeSpec)
def validate_sql_mode(
    payload: SqlModeSpec,
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
) -> SqlModeSpec | JSONResponse:
    try:
        return sql_mode_service.validate_sql_mode(payload)
    except DesignerError as exc:
        return _designer_error(exc)


@router.get("/sql-mode/capabilities")
def get_sql_mode_capabilities(
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
) -> dict:
    return sql_mode_service.sql_mode_capabilities()


@router.put("/sql-mode", response_model=SqlModeSpec)
def save_sql_mode(
    payload: SqlModeSpec,
    actor: Annotated[UserContext, Depends(require_permission(PERM_EDIT))],
    db: Annotated[Session, Depends(_db)],
) -> SqlModeSpec | JSONResponse:
    try:
        config, _ = sql_mode_service.save_sql_mode(db, payload, _owner_uuid(actor))
        return config
    except ConfigError as exc:
        return _config_error(exc)
    except DesignerError as exc:
        return _designer_error(exc)


@router.get("/sql-mode", response_model=SqlModeSpec)
def get_sql_mode(
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
    ref_type: str = "design_draft",
    ref_id: uuid.UUID | None = Query(default=None, alias="ref_id"),
    ref_id_camel: uuid.UUID | None = Query(default=None, alias="refId"),
) -> SqlModeSpec | JSONResponse:
    resolved_ref = ref_id if ref_id is not None else ref_id_camel
    if resolved_ref is None:
        return JSONResponse(
            status_code=422,
            content={"code": "DESIGN_MISSING_REF", "message": "ref_id is required", "detail": None},
        )
    try:
        return sql_mode_service.get_sql_mode(db, ref_type, resolved_ref)
    except ConfigError as exc:
        return _config_error(exc)
    except DesignerError as exc:
        return _designer_error(exc)


@router.post("/output-fields/validate", response_model=OutputFieldsConfig)
def validate_output_fields(
    payload: OutputFieldsConfig,
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
    dataset_id: uuid.UUID | None = Query(default=None, alias="datasetId"),
) -> OutputFieldsConfig | JSONResponse:
    try:
        return output_fields_service.validate_output_fields_config(db, payload, dataset_id=dataset_id)
    except DesignerError as exc:
        return _designer_error(exc)


@router.put("/output-fields", response_model=OutputFieldsConfig)
def save_output_fields(
    payload: OutputFieldsConfig,
    actor: Annotated[UserContext, Depends(require_permission(PERM_EDIT))],
    db: Annotated[Session, Depends(_db)],
    dataset_id: uuid.UUID | None = Query(default=None, alias="datasetId"),
) -> OutputFieldsConfig | JSONResponse:
    try:
        output_fields_service.validate_output_fields_config(db, payload, dataset_id=dataset_id)
        config, _ = output_fields_service.save_output_fields(
            db, payload, _owner_uuid(actor), dataset_id=dataset_id,
        )
        return config
    except ConfigError as exc:
        return _config_error(exc)
    except DesignerError as exc:
        return _designer_error(exc)


@router.get("/output-fields", response_model=OutputFieldsConfig)
def get_output_fields(
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
    ref_type: str = "design_draft",
    ref_id: uuid.UUID | None = Query(default=None, alias="ref_id"),
    ref_id_camel: uuid.UUID | None = Query(default=None, alias="refId"),
) -> OutputFieldsConfig | JSONResponse:
    resolved_ref = ref_id if ref_id is not None else ref_id_camel
    if resolved_ref is None:
        return JSONResponse(
            status_code=422,
            content={"code": "DESIGN_MISSING_REF", "message": "ref_id is required", "detail": None},
        )
    try:
        return output_fields_service.get_output_fields(db, ref_type, resolved_ref)
    except ConfigError as exc:
        return _config_error(exc)
    except DesignerError as exc:
        return _designer_error(exc)


@router.put("/compute-rules", response_model=ComputeRulesConfig)
def save_compute_rules(
    payload: ComputeRulesConfig,
    actor: Annotated[UserContext, Depends(require_permission(PERM_EDIT))],
    db: Annotated[Session, Depends(_db)],
) -> ComputeRulesConfig | JSONResponse:
    try:
        config, _ = designer_service.save_compute_rules(db, payload, _owner_uuid(actor))
        return config
    except DesignerError as exc:
        return _designer_error(exc)


@router.get("/compute-rules", response_model=ComputeRulesConfig)
def get_compute_rules(
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
    ref_type: str = "design_draft",
    ref_id: uuid.UUID | None = Query(default=None, alias="ref_id"),
    ref_id_camel: uuid.UUID | None = Query(default=None, alias="refId"),
) -> ComputeRulesConfig | JSONResponse:
    ref_id = ref_id if ref_id is not None else ref_id_camel
    if ref_id is None:
        return JSONResponse(
            status_code=422,
            content={
                "code": "DESIGN_MISSING_REF",
                "message": "ref_id is required",
                "detail": None,
            },
        )
    try:
        return designer_service.get_compute_rules(db, ref_type, ref_id)
    except Exception as exc:
        from app.query.config_store.schemas import ConfigError

        if isinstance(exc, ConfigError):
            return JSONResponse(
                status_code=exc.status,
                content={"code": exc.code, "message": exc.message, "detail": None},
            )
        if isinstance(exc, DesignerError):
            return _designer_error(exc)
        raise


@router.post("/workflow-link/validate", response_model=DesignerWorkflowLinkValidateOut)
def validate_workflow_link(
    body: dict,
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
) -> DesignerWorkflowLinkValidateOut | JSONResponse:
    if not body.get("designerItemId"):
        return _designer_error(DesignerError("DESIGN_WORKFLOW_INVALID_ITEM", "designerItemId required", 422))
    try:
        payload = DesignerWorkflowLinkIn.model_validate(body)
    except ValidationError:
        return _designer_error(DesignerError("DESIGN_WORKFLOW_INVALID_ITEM", "designerItemId required", 422))
    try:
        return workflow_link_service.validate_workflow_link(db, payload)
    except DesignerError as exc:
        return _designer_error(exc)


@router.put("/workflow-link", response_model=DesignerWorkflowLinkOut)
def save_workflow_link(
    payload: DesignerWorkflowLinkIn,
    actor: Annotated[UserContext, Depends(require_permission(PERM_EDIT))],
    db: Annotated[Session, Depends(_db)],
) -> DesignerWorkflowLinkOut | JSONResponse:
    try:
        return workflow_link_service.save_workflow_link(db, payload, _owner_uuid(actor))
    except DesignerError as exc:
        return _designer_error(exc)


@router.get("/workflow-link", response_model=DesignerWorkflowLinkOut)
def get_workflow_link(
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
    designer_item_id: uuid.UUID | None = Query(default=None, alias="designerItemId"),
    workflow_instance_id: uuid.UUID | None = Query(default=None, alias="workflowInstanceId"),
) -> DesignerWorkflowLinkOut | JSONResponse:
    try:
        if designer_item_id is not None:
            return workflow_link_service.get_workflow_link(db, designer_item_id)
        if workflow_instance_id is not None:
            return workflow_link_service.get_link_by_instance(db, workflow_instance_id)
        return _designer_error(
            DesignerError(
                "DESIGN_WORKFLOW_INVALID_ITEM",
                "designerItemId or workflowInstanceId required",
                422,
            )
        )
    except DesignerError as exc:
        return _designer_error(exc)


@router.delete("/workflow-link", status_code=204)
def delete_workflow_link_route(
    actor: Annotated[UserContext, Depends(require_permission(PERM_EDIT))],
    db: Annotated[Session, Depends(_db)],
    designer_item_id: uuid.UUID = Query(alias="designerItemId"),
):
    try:
        workflow_link_service.delete_workflow_link(db, designer_item_id, actor)
        return Response(status_code=204)
    except DesignerError as exc:
        return _designer_error(exc)


@router.get("/snapshots/{snapshot_id}")
def get_designer_snapshot(
    snapshot_id: uuid.UUID,
    actor: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
):
    try:
        return snapshot_service.get_snapshot_for_actor(db, snapshot_id, actor)
    except DesignerError as exc:
        return _designer_error(exc)


@router.get("/design-mode")
def get_design_mode_route(
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
    ref_id: uuid.UUID = Query(alias="refId"),
    ref_type: str = Query(default="design_draft", alias="refType"),
):
    return {"refId": str(ref_id), "mode": sql_mode_service.get_design_mode(db, ref_type, ref_id)}


@router.put("/design-mode")
def put_design_mode_route(
    payload: DesignModeIn,
    actor: Annotated[UserContext, Depends(require_permission(PERM_EDIT))],
    db: Annotated[Session, Depends(_db)],
):
    try:
        return sql_mode_service.set_design_mode(
            db, "design_draft", payload.ref_id, payload.mode, _owner_uuid(actor)
        )
    except DesignerError as exc:
        return _designer_error(exc)


@router.get("/fields", response_model=FieldRegistryOut)
def get_designer_fields(
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
    dataset_id: uuid.UUID | None = Query(default=None, alias="datasetId"),
) -> FieldRegistryOut:
    return designer_service.list_designer_fields(db, dataset_id)


@router.post("/preview/translate", response_model=None)
def preview_translate(
    payload: PreviewTranslateIn,
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
) -> dict | JSONResponse:
    try:
        return designer_service.preview_translate_sql(db, payload)
    except DesignerError as exc:
        return _designer_error(exc)


@router.post("/submit-workflow", status_code=201, response_model=DesignerSubmitWorkflowOut)
def submit_designer_workflow(
    payload: DesignerSubmitWorkflowIn,
    actor: Annotated[UserContext, Depends(require_permission(PERM_EDIT))],
    db: Annotated[Session, Depends(_db)],
) -> DesignerSubmitWorkflowOut | JSONResponse:
    try:
        return workflow_link_service.submit_with_snapshot(db, payload, actor)
    except DesignerError as exc:
        return _designer_error(exc)
