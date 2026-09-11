from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse
from starlette.responses import Response
from sqlalchemy.orm import Session

from app.auth.deps import UserContext, require_permission

PERM_READ = "governance:read"
PERM_MANAGE = "governance:manage"
from app.datasources.models import get_meta_session
from app.governance.catalog import service as catalog_service
from app.governance.catalog.schemas import (
    AppendixETaxonomyOut,
    BusRegisterIn,
    BusRegisterOut,
    CatalogEntryCreate,
    CatalogEntryOut,
    CatalogListResponse,
    CategoryListResponse,
    SemiAutoFsmOut,
)
from app.governance.query_design import service as query_design_service
from app.governance.query_design.schemas import (
    GovQueryDesignError,
    PreviewExecuteIn,
    PreviewExecuteOut,
    VisualQueryDesignIn,
    VisualQueryDesignOut,
)
from app.governance.publish.errors import PublishError
from app.governance.publish import service as publish_service
from app.governance.publish.notifications import list_notifications
from app.governance.publish.schemas import (
    PublishActionOut,
    PublishFromWorkflowIn,
    PublishFromWorkflowOut,
    PublishLinkPhysicalIn,
    PublishNotificationListOut,
    PublishNotificationOut,
    PublishStatusOut,
)
from app.governance.workflow.errors import WorkflowError
from app.governance.workflow import service as workflow_service
from app.governance.workflow.node_roles import describe_node_roles
from app.governance.workflow.schemas import (
    NodeRoleOut,
    WorkflowInstanceCreateIn,
    WorkflowInstanceListOut,
    WorkflowInstanceOut,
    WorkflowNodeRolesOut,
    WorkflowTemplateCreateIn,
    WorkflowTemplateListOut,
    WorkflowTemplateOut,
    WorkflowTemplateUpdateIn,
    WorkflowTemplateValidateIn,
    WorkflowTransitionIn,
)
from app.governance.openapi.errors import OpenApiMappingError
from app.governance.openapi.schemas import (
    OpenApiMappingCreate,
    OpenApiMappingListOut,
    OpenApiMappingValidateOut,
)
from app.governance.openapi import service as openapi_service
from app.governance.catalog.classification.errors import ClassificationError
from app.governance.catalog.classification.schemas import (
    ClassificationNodeCreate,
    ClassificationNodeListResponse,
    ClassificationNodeMove,
    ClassificationNodeOut,
)
from app.governance.catalog.classification import service as classification_service
from app.governance.catalog.cat06.errors import Cat06Error
from app.governance.catalog.cat06.schemas import (
    ProductionStatsItemIn,
    ProductionStatsItemOut,
    ProductionStatsListResponse,
    ProductionStatsProbeOut,
    ProductionStatsValidateOut,
)
from app.governance.catalog.cat06 import service as cat06_service
from app.governance.catalog.cat01.errors import Cat01Error
from app.governance.catalog.cat01.schemas import (
    LifecycleStageMove,
    LifecycleTemplateIn,
    LifecycleTemplateListResponse,
    LifecycleTemplateOut,
    LifecycleTemplateValidateOut,
)
from app.governance.catalog.cat01 import service as cat01_service
from app.governance.catalog.cat02.errors import Cat02Error
from app.governance.catalog.cat02.schemas import (
    AggregateAttributionOut,
    AggregateTemplateIn,
    AggregateTemplateListResponse,
    AggregateTemplateOut,
    AggregateTemplateValidateOut,
)
from app.governance.catalog.cat02 import service as cat02_service
from app.governance.catalog.cat05.errors import Cat05Error
from app.governance.catalog.cat05.schemas import (
    TicketStatsItemIn,
    TicketStatsItemOut,
    TicketStatsListResponse,
    TicketStatsProbeOut,
    TicketStatsValidateOut,
)
from app.governance.catalog.cat05 import service as cat05_service
from app.governance.catalog.cat03.errors import Cat03Error
from app.governance.catalog.cat03.schemas import (
    GeoRegionCreate,
    GeoRegionListResponse,
    GeoRegionMove,
    GeoRegionOut,
)
from app.governance.catalog.cat03 import service as cat03_service
from app.governance.acl import GovAclError, assert_workflow_transition, workflow_role_for_action
from app.governance.acl_matrix import describe_gov_permission_matrix
from app.governance.bus.auto import auto_register
from app.governance.bus.auto_schemas import AutoRegisterIn, AutoRegisterOut
from app.governance.bus.pipeline import retry_auto_register

router = APIRouter(prefix="/gov", tags=["governance", "IF-06"])


def _db() -> Session:
    session = get_meta_session()
    try:
        yield session
    finally:
        session.close()


def _catalog_error_response(exc: catalog_service.CatalogError) -> JSONResponse:
    detail = None
    if getattr(exc, "trace_id", None):
        detail = {"traceId": exc.trace_id}
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": detail},
    )


@router.get("/catalog/categories", response_model=CategoryListResponse)
def list_catalog_categories(
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
) -> CategoryListResponse | JSONResponse:
    return catalog_service.list_categories(db)


@router.get("/catalog/appendix-e", response_model=None)
def read_appendix_e_taxonomy(
    actor: Annotated[UserContext, Depends(require_permission(PERM_READ))],
) -> AppendixETaxonomyOut | JSONResponse:
    try:
        return catalog_service.get_appendix_e_taxonomy_for_actor(actor)
    except catalog_service.CatalogError as exc:
        return _catalog_error_response(exc)


@router.get("/catalog/entries", response_model=CatalogListResponse)
def list_catalog_entries(
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
    category: str | None = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> CatalogListResponse | JSONResponse:
    try:
        return catalog_service.list_entries(db, category=category, limit=limit, offset=offset)
    except catalog_service.CatalogError as exc:
        return _catalog_error_response(exc)


@router.post("/catalog/entries", status_code=201, response_model=CatalogEntryOut)
def create_catalog_entry(
    payload: CatalogEntryCreate,
    _: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> CatalogEntryOut | JSONResponse:
    try:
        return catalog_service.create_entry(db, payload)
    except catalog_service.CatalogError as exc:
        return _catalog_error_response(exc)


@router.get("/catalog/entries/{entry_id}", response_model=CatalogEntryOut)
def get_catalog_entry(
    entry_id: uuid.UUID,
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
) -> CatalogEntryOut | JSONResponse:
    try:
        return catalog_service.get_entry(db, entry_id)
    except catalog_service.CatalogError as exc:
        return _catalog_error_response(exc)


@router.delete("/catalog/entries/{entry_id}", response_model=None)
def delete_catalog_entry(
    entry_id: uuid.UUID,
    _: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> Response | JSONResponse:
    try:
        catalog_service.delete_entry(db, entry_id)
        return Response(status_code=204)
    except catalog_service.CatalogError as exc:
        return _catalog_error_response(exc)


@router.post("/bus/register", response_model=BusRegisterOut)
def register_bus(
    payload: BusRegisterIn,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> BusRegisterOut | JSONResponse:
    try:
        entry = catalog_service.get_entry(db, payload.catalog_entry_id)
        from app.governance.bus.poc_fsm import assert_bus_register_path_scope

        assert_bus_register_path_scope(actor, entry.path)
        out, created = catalog_service.register_entry_to_bus(db, payload.catalog_entry_id)
        return JSONResponse(
            status_code=201 if created else 200,
            content=out.model_dump(by_alias=True, mode="json"),
        )
    except catalog_service.CatalogError as exc:
        return _catalog_error_response(exc)


@router.get("/bus/register/fsm", response_model=None)
def get_bus_register_fsm(
    catalog_entry_id: Annotated[uuid.UUID, Query(alias="catalogEntryId")],
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
) -> JSONResponse:
    from sqlalchemy import select

    from app.governance.bus.poc_fsm import get_semi_auto_fsm
    from app.governance.catalog.models import BusRegistration

    try:
        catalog_service.get_entry(db, catalog_entry_id)
    except catalog_service.CatalogError as exc:
        return _catalog_error_response(exc)
    state = get_semi_auto_fsm(db, catalog_entry_id)
    bus_id = None
    row = db.scalar(
        select(BusRegistration).where(
            BusRegistration.catalog_entry_id == catalog_entry_id,
            BusRegistration.status == "succeeded",
        )
    )
    if row and row.bus_payload:
        bus_id = row.bus_payload.get("busId")
    out = SemiAutoFsmOut(fsmState=state, catalogEntryId=catalog_entry_id, busId=bus_id)
    return JSONResponse(status_code=200, content=out.model_dump(by_alias=True, mode="json"))


@router.get("/bus/register/probe", response_model=None)
def semi_auto_register_probe(
    actor: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
) -> JSONResponse:
    from app.governance.bus.probe import probe_semi_auto_register_budget_ms
    result = probe_semi_auto_register_budget_ms(db, actor)
    return JSONResponse(
        status_code=200,
        content={"elapsedMs": result.elapsed_ms, "ok": result.ok},
    )


@router.post("/bus/auto-register/retry", response_model=None)
def auto_register_retry(
    payload: AutoRegisterIn,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
):
    try:
        out, code = retry_auto_register(db, actor, payload.catalog_entry_id)
        return JSONResponse(status_code=code, content=out.model_dump(by_alias=True, mode="json"))
    except catalog_service.CatalogError as exc:
        return _catalog_error_response(exc)


@router.get("/acl/matrix")
def gov_acl_matrix(actor: Annotated[UserContext, Depends(require_permission(PERM_READ))]):
    return describe_gov_permission_matrix()


@router.post("/bus/auto-register", response_model=None)
def auto_register_bus(
    payload: AutoRegisterIn,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> AutoRegisterOut | JSONResponse:
    try:
        out, code = auto_register(db, actor, payload.catalog_entry_id)
        return JSONResponse(status_code=code, content=out.model_dump(by_alias=True, mode="json"))
    except catalog_service.CatalogError as exc:
        return _catalog_error_response(exc)


@router.get("/bus/auto-register/probe", response_model=None)
def auto_register_probe(
    actor: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
) -> JSONResponse:
    from app.governance.bus.probe import probe_auto_register_budget_ms
    from app.governance.catalog.models import CatalogEntry
    from sqlalchemy import select

    entry = db.scalar(
        select(CatalogEntry).where(CatalogEntry.status == "published").limit(1),
    )
    if entry is None:
        return JSONResponse(
            status_code=503,
            content={
                "code": "GOV_PROBE_NO_FIXTURE",
                "message": "No published catalog entry available for probe",
                "detail": None,
            },
        )
    result = probe_auto_register_budget_ms(db, actor, entry.id)
    return JSONResponse(
        status_code=200,
        content={
            "elapsedMs": result.elapsed_ms,
            "withinBudget": result.ok,
            "ok": result.ok,
        },
    )


def _gov_query_design_error(exc: GovQueryDesignError) -> JSONResponse:
    detail = {"fields": exc.fields} if exc.fields else None
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": detail},
    )


def _publish_error_response(exc: PublishError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": None},
    )


def _gov_acl_error(exc: GovAclError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": None},
    )


@router.post("/publish/entries/{entry_id}/submit", response_model=PublishActionOut)
def publish_submit(
    entry_id: uuid.UUID,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> PublishActionOut | JSONResponse:
    try:
        return publish_service.submit_entry(db, entry_id, actor)
    except PublishError as exc:
        return _publish_error_response(exc)
    except GovAclError as exc:
        return _gov_acl_error(exc)


@router.post("/publish/entries/{entry_id}/approve", response_model=PublishActionOut)
def publish_approve(
    entry_id: uuid.UUID,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> PublishActionOut | JSONResponse:
    try:
        return publish_service.approve_entry(db, entry_id, actor)
    except PublishError as exc:
        return _publish_error_response(exc)
    except GovAclError as exc:
        return _gov_acl_error(exc)


@router.post("/publish/entries/{entry_id}/reject", response_model=PublishActionOut)
def publish_reject(
    entry_id: uuid.UUID,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> PublishActionOut | JSONResponse:
    try:
        return publish_service.reject_entry(db, entry_id, actor)
    except PublishError as exc:
        return _publish_error_response(exc)
    except GovAclError as exc:
        return _gov_acl_error(exc)


@router.post("/publish/entries/{entry_id}/unpublish", response_model=PublishActionOut)
def publish_unpublish(
    entry_id: uuid.UUID,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> PublishActionOut | JSONResponse:
    try:
        return publish_service.unpublish_entry(db, entry_id, actor)
    except PublishError as exc:
        return _publish_error_response(exc)
    except GovAclError as exc:
        return _gov_acl_error(exc)


@router.post("/publish/entries/{entry_id}/link-physical", response_model=PublishActionOut)
def publish_link_physical(
    entry_id: uuid.UUID,
    payload: PublishLinkPhysicalIn,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> PublishActionOut | JSONResponse:
    from app.metadata.physical import gov_refs as physical_gov_refs
    from app.metadata.physical import service as physical_service
    from app.metadata.physical.errors import PhysicalTableError

    try:
        status = publish_service.get_publish_status(db, entry_id)
        physical_service.get_physical_table(payload.table_fqn)
        physical_gov_refs.register_catalog_ref(payload.table_fqn, str(entry_id))
        return PublishActionOut(id=status.id, status=status.status)
    except PublishError as exc:
        return _publish_error_response(exc)
    except PhysicalTableError as exc:
        return JSONResponse(
            status_code=exc.status,
            content={"code": exc.code, "message": exc.message},
        )
    except GovAclError as exc:
        return _gov_acl_error(exc)


@router.get("/publish/entries/{entry_id}/status", response_model=PublishStatusOut)
def publish_status(
    entry_id: uuid.UUID,
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
) -> PublishStatusOut | JSONResponse:
    try:
        return publish_service.get_publish_status(db, entry_id)
    except PublishError as exc:
        return _publish_error_response(exc)


@router.get("/publish/entries/{entry_id}/openapi")
def get_publish_openapi(
    entry_id: uuid.UUID,
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
):
    try:
        return openapi_service.generate_openapi_document(db, entry_id)
    except OpenApiMappingError as exc:
        return _openapi_mapping_error(exc)


@router.post("/publish/from-workflow", response_model=PublishFromWorkflowOut)
def publish_from_workflow_route(
    payload: PublishFromWorkflowIn,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> PublishFromWorkflowOut | JSONResponse:
    try:
        return publish_service.publish_from_workflow(db, payload.workflow_instance_id, actor)
    except PublishError as exc:
        return _publish_error_response(exc)


@router.get("/publish/entries/{entry_id}/notifications", response_model=PublishNotificationListOut)
def publish_notifications(
    entry_id: uuid.UUID,
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
) -> PublishNotificationListOut | JSONResponse:
    try:
        publish_service.get_publish_status(db, entry_id)
    except PublishError as exc:
        return _publish_error_response(exc)
    events = list_notifications(entry_id)
    return PublishNotificationListOut(
        items=[
            PublishNotificationOut(
                id=e.id,
                entryId=e.entry_id,
                eventType=e.event_type,
                timestamp=e.timestamp,
                deliveryMode=e.delivery_mode,
                notificationStatus=e.notification_status,
                message=e.message,
            )
            for e in events
        ]
    )


@router.post("/query-design/validate", response_model=VisualQueryDesignOut)
def validate_query_design(
    payload: VisualQueryDesignIn,
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
) -> VisualQueryDesignOut | JSONResponse:
    try:
        return query_design_service.validate_visual_query_design(db, payload)
    except GovQueryDesignError as exc:
        return _gov_query_design_error(exc)


@router.put("/query-design", response_model=VisualQueryDesignOut)
def save_query_design(
    payload: VisualQueryDesignIn,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> VisualQueryDesignOut | JSONResponse:
    try:
        return query_design_service.save_visual_query_design(db, payload, actor)
    except GovQueryDesignError as exc:
        return _gov_query_design_error(exc)


@router.get("/query-design", response_model=VisualQueryDesignOut)
def get_query_design(
    ref_id: Annotated[uuid.UUID, Query(alias="refId")],
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
) -> VisualQueryDesignOut | JSONResponse:
    try:
        return query_design_service.get_visual_query_design(db, ref_id)
    except GovQueryDesignError as exc:
        return _gov_query_design_error(exc)


@router.post("/query-design/preview-execute", response_model=PreviewExecuteOut)
def preview_execute_query_design(
    payload: PreviewExecuteIn,
    actor: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
) -> PreviewExecuteOut | JSONResponse:
    try:
        return query_design_service.preview_query_design_execute(
            db, actor, data_source_id=payload.data_source_id
        )
    except GovQueryDesignError as exc:
        return _gov_query_design_error(exc)


def _workflow_error(exc: WorkflowError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": exc.detail},
    )


def _openapi_mapping_error(exc: OpenApiMappingError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": None},
    )


@router.get("/openapi-mappings", response_model=OpenApiMappingListOut)
def list_openapi_mappings(
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    catalog_entry_id: uuid.UUID | None = Query(default=None, alias="catalogEntryId"),
) -> OpenApiMappingListOut:
    return openapi_service.list_mappings(catalog_entry_id)


@router.get("/openapi-mappings/{mapping_id}", response_model=None)
def get_openapi_mapping(
    mapping_id: uuid.UUID,
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
):
    try:
        return openapi_service.get_mapping(mapping_id)
    except OpenApiMappingError as exc:
        return _openapi_mapping_error(exc)


@router.post("/openapi-mappings", status_code=status.HTTP_201_CREATED, response_model=None)
def register_openapi_mapping(
    payload: OpenApiMappingCreate,
    _: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
):
    try:
        return openapi_service.register_mapping(db, payload)
    except OpenApiMappingError as exc:
        return _openapi_mapping_error(exc)


@router.post("/openapi-mappings/validate", response_model=OpenApiMappingValidateOut)
def validate_openapi_mapping(
    payload: OpenApiMappingCreate,
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
):
    try:
        return openapi_service.validate_mapping(payload)
    except OpenApiMappingError as exc:
        return _openapi_mapping_error(exc)


@router.post("/openapi-mappings/{mapping_id}/deactivate", response_model=None)
def deactivate_openapi_mapping(
    mapping_id: uuid.UUID,
    _: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
):
    try:
        return openapi_service.deactivate_mapping(mapping_id)
    except OpenApiMappingError as exc:
        return _openapi_mapping_error(exc)


@router.get("/workflow/templates", response_model=WorkflowTemplateListOut)
def list_workflow_templates(
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
) -> WorkflowTemplateListOut:
    return WorkflowTemplateListOut(items=workflow_service.list_templates(db))


@router.get("/workflow/templates/{template_id}/node-roles", response_model=WorkflowNodeRolesOut)
def get_workflow_node_roles(
    template_id: str,
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
) -> WorkflowNodeRolesOut | JSONResponse:
    try:
        items = describe_node_roles(db, template_id)
        return WorkflowNodeRolesOut(
            items=[
                NodeRoleOut(nodeId=i.node_id, role=i.role, description=i.description)
                for i in items
            ]
        )
    except WorkflowError as exc:
        return _workflow_error(exc)


@router.post("/workflow/templates/validate", response_model=WorkflowTemplateOut)
def validate_workflow_template(
    payload: WorkflowTemplateValidateIn,
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
) -> WorkflowTemplateOut | JSONResponse:
    try:
        return workflow_service.validate_template(payload)
    except WorkflowError as exc:
        return _workflow_error(exc)


@router.post("/workflow/templates", status_code=201, response_model=WorkflowTemplateOut)
def create_workflow_template(
    payload: WorkflowTemplateCreateIn,
    _: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> WorkflowTemplateOut | JSONResponse:
    try:
        return workflow_service.create_template(db, payload)
    except WorkflowError as exc:
        return _workflow_error(exc)


@router.put("/workflow/templates/{template_id}", response_model=WorkflowTemplateOut)
def update_workflow_template(
    template_id: str,
    payload: WorkflowTemplateUpdateIn,
    _: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> WorkflowTemplateOut | JSONResponse:
    try:
        return workflow_service.update_template(db, template_id, payload)
    except WorkflowError as exc:
        return _workflow_error(exc)


@router.delete("/workflow/templates/{template_id}")
def delete_workflow_template(
    template_id: str,
    _: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
):
    try:
        workflow_service.delete_template(db, template_id)
        return Response(status_code=204)
    except WorkflowError as exc:
        return _workflow_error(exc)


@router.post("/workflow/instances", status_code=201, response_model=WorkflowInstanceOut)
def create_workflow_instance(
    payload: WorkflowInstanceCreateIn,
    _: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> WorkflowInstanceOut | JSONResponse:
    try:
        return workflow_service.create_instance(db, payload)
    except WorkflowError as exc:
        return _workflow_error(exc)


@router.get("/workflow/instances", response_model=WorkflowInstanceListOut)
def list_workflow_instances(
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    status: str | None = None,
) -> WorkflowInstanceListOut:
    return workflow_service.list_instances(db, limit=limit, offset=offset, status=status)


@router.get("/workflow/instances/{instance_id}", response_model=WorkflowInstanceOut)
def get_workflow_instance(
    instance_id: uuid.UUID,
    actor: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
    include_design_snapshot: bool = Query(default=False, alias="includeDesignSnapshot"),
) -> WorkflowInstanceOut | JSONResponse:
    try:
        return workflow_service.get_instance(
            db, instance_id, include_snapshot=include_design_snapshot, actor=actor
        )
    except Exception as exc:
        from app.query.config_store.schemas import ConfigError

        if isinstance(exc, ConfigError):
            return JSONResponse(
                status_code=404,
                content={"code": "GOV_WORKFLOW_INSTANCE_NOT_FOUND", "message": "Instance not found", "detail": None},
            )
        raise


@router.post("/workflow/instances/{instance_id}/transition", response_model=WorkflowInstanceOut)
def transition_workflow_instance(
    instance_id: uuid.UUID,
    payload: WorkflowTransitionIn,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> WorkflowInstanceOut | JSONResponse:
    try:
        assert_workflow_transition(actor, payload.action, payload.actor_role)
        required_role = workflow_role_for_action(payload.action)
        if required_role is None:
            return JSONResponse(
                status_code=400,
                content={"code": "GOV_WORKFLOW_INVALID_TRANSITION", "message": "Unknown action", "detail": None},
            )
        actor_role = required_role if not actor.is_root else payload.actor_role or required_role
        return workflow_service.transition_instance(db, instance_id, payload.action, actor_role)
    except GovAclError as exc:
        return _gov_acl_error(exc)
    except WorkflowError as exc:
        return _workflow_error(exc)


@router.get("/workflow/instances/{instance_id}/approved-design", response_model=VisualQueryDesignOut)
def get_approved_design(
    instance_id: uuid.UUID,
    actor: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
) -> VisualQueryDesignOut | JSONResponse:
    try:
        return query_design_service.load_design_from_workflow(db, instance_id, actor)
    except GovQueryDesignError as exc:
        return _gov_query_design_error(exc)


@router.post("/workflow/instances/{instance_id}/confirm-design", response_model=WorkflowInstanceOut)
def confirm_design(
    instance_id: uuid.UUID,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> WorkflowInstanceOut | JSONResponse:
    try:
        return query_design_service.confirm_approved_design(db, instance_id, actor)
    except GovQueryDesignError as exc:
        return _gov_query_design_error(exc)


def _classification_error(exc: ClassificationError) -> JSONResponse:
    detail = {"fields": exc.fields} if exc.fields else None
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": detail},
    )


@router.get("/catalog/classification/nodes", response_model=ClassificationNodeListResponse)
def list_classification_nodes(
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    parent_id: uuid.UUID | None = Query(default=None, alias="parentId"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> ClassificationNodeListResponse:
    return classification_service.list_nodes(parent_id, limit, offset)


@router.post("/catalog/classification/nodes", response_model=ClassificationNodeOut, status_code=status.HTTP_201_CREATED)
def create_classification_node(
    payload: ClassificationNodeCreate,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
) -> ClassificationNodeOut | JSONResponse:
    try:
        return classification_service.create_node(payload, actor)
    except ClassificationError as exc:
        return _classification_error(exc)


@router.post("/catalog/classification/nodes/{node_id}/move", response_model=ClassificationNodeOut)
def move_classification_node(
    node_id: uuid.UUID,
    payload: ClassificationNodeMove,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
) -> ClassificationNodeOut | JSONResponse:
    try:
        return classification_service.move_node(node_id, payload, actor)
    except ClassificationError as exc:
        return _classification_error(exc)


@router.delete("/catalog/classification/nodes/{node_id}", response_model=None)
def delete_classification_node(
    node_id: uuid.UUID,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
) -> Response | JSONResponse:
    try:
        classification_service.delete_node(node_id, actor)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except ClassificationError as exc:
        return _classification_error(exc)


@router.get("/catalog/classification/m11-probe", response_model=None)
def cat04_m11_probe(
    actor: Annotated[UserContext, Depends(require_permission(PERM_READ))],
) -> JSONResponse:
    from app.governance.catalog.cat04.handler import run_cat04_catalog_probe

    out = run_cat04_catalog_probe(actor)
    return JSONResponse(status_code=200, content=out.model_dump(by_alias=True, mode="json"))


def _cat05_error(exc: Cat05Error) -> JSONResponse:
    detail = {"fields": exc.fields} if exc.fields else None
    return JSONResponse(status_code=exc.status, content={"code": exc.code, "message": exc.message, "detail": detail})


@router.post("/catalog/tickets/validate", response_model=TicketStatsValidateOut)
def validate_ticket_stats_item(
    payload: TicketStatsItemIn,
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
) -> TicketStatsValidateOut | JSONResponse:
    try:
        return cat05_service.validate_ticket_item(payload)
    except Cat05Error as exc:
        return _cat05_error(exc)


@router.post("/catalog/tickets/items", response_model=TicketStatsItemOut, status_code=status.HTTP_201_CREATED)
def create_ticket_stats_item(
    payload: TicketStatsItemIn,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
) -> TicketStatsItemOut | JSONResponse:
    try:
        return cat05_service.create_ticket_item(payload, actor)
    except Cat05Error as exc:
        return _cat05_error(exc)


@router.get("/catalog/tickets/items", response_model=TicketStatsListResponse)
def list_ticket_stats_items(
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> TicketStatsListResponse:
    return cat05_service.list_ticket_items(limit, offset)


@router.get("/catalog/tickets/items/{key}/stats", response_model=TicketStatsProbeOut)
def probe_ticket_stats(
    key: str,
    actor: Annotated[UserContext, Depends(require_permission(PERM_READ))],
) -> TicketStatsProbeOut | JSONResponse:
    try:
        return cat05_service.get_ticket_stats(key, actor)
    except Cat05Error as exc:
        return _cat05_error(exc)


@router.get("/catalog/tickets/m11-probe", response_model=None)
def cat05_m11_probe(
    actor: Annotated[UserContext, Depends(require_permission(PERM_READ))],
) -> JSONResponse:
    from app.governance.catalog.cat05.handler import run_cat05_catalog_probe

    out = run_cat05_catalog_probe(actor)
    return JSONResponse(status_code=200, content=out.model_dump(by_alias=True, mode="json"))


def _cat03_error(exc: Cat03Error) -> JSONResponse:
    detail = {"fields": exc.fields} if exc.fields else None
    return JSONResponse(status_code=exc.status, content={"code": exc.code, "message": exc.message, "detail": detail})


@router.get("/catalog/geo-regions/m6-probe", response_model=None)
def cat03_m6_probe(
    actor: Annotated[UserContext, Depends(require_permission(PERM_READ))],
) -> JSONResponse:
    from app.governance.catalog.cat03.handler import run_cat03_catalog_probe

    out = run_cat03_catalog_probe(actor)
    return JSONResponse(status_code=200, content=out.model_dump(by_alias=True, mode="json"))


@router.get("/catalog/geo-regions/nodes", response_model=GeoRegionListResponse)
def list_geo_region_nodes(
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    parent_id: uuid.UUID | None = Query(default=None, alias="parentId"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> GeoRegionListResponse:
    return cat03_service.list_geo_nodes(parent_id, limit, offset)


@router.post("/catalog/geo-regions/nodes", response_model=GeoRegionOut, status_code=status.HTTP_201_CREATED)
def create_geo_region_node(
    payload: GeoRegionCreate,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
) -> GeoRegionOut | JSONResponse:
    try:
        return cat03_service.create_geo_node(payload, actor)
    except Cat03Error as exc:
        return _cat03_error(exc)


@router.post("/catalog/geo-regions/nodes/{region_id}/move", response_model=GeoRegionOut)
def move_geo_region_node(
    region_id: uuid.UUID,
    payload: GeoRegionMove,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
) -> GeoRegionOut | JSONResponse:
    try:
        return cat03_service.move_geo_node(region_id, payload, actor)
    except Cat03Error as exc:
        return _cat03_error(exc)


@router.delete("/catalog/geo-regions/nodes/{region_id}", response_model=None)
def delete_geo_region_node(
    region_id: uuid.UUID,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
) -> Response | JSONResponse:
    try:
        cat03_service.delete_geo_node(region_id, actor)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except Cat03Error as exc:
        return _cat03_error(exc)


def _cat06_error(exc: Cat06Error) -> JSONResponse:
    detail = {"fields": exc.fields} if exc.fields else None
    return JSONResponse(status_code=exc.status, content={"code": exc.code, "message": exc.message, "detail": detail})


@router.post("/catalog/production-stats/validate", response_model=ProductionStatsValidateOut)
def production_stats_validate(
    payload: ProductionStatsItemIn,
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
) -> ProductionStatsValidateOut | JSONResponse:
    try:
        return cat06_service.validate_production_stats(payload)
    except Cat06Error as exc:
        return _cat06_error(exc)


@router.post("/catalog/production-stats", response_model=ProductionStatsItemOut, status_code=status.HTTP_201_CREATED)
def production_stats_create(
    payload: ProductionStatsItemIn,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
) -> ProductionStatsItemOut | JSONResponse:
    try:
        return cat06_service.create_production_stats(payload, actor)
    except Cat06Error as exc:
        return _cat06_error(exc)


@router.get("/catalog/production-stats", response_model=ProductionStatsListResponse)
def production_stats_list(
    actor: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> ProductionStatsListResponse:
    return cat06_service.list_production_stats(actor, limit, offset)


@router.get("/catalog/production-stats/{stats_key}/stats", response_model=ProductionStatsProbeOut)
def production_stats_probe(
    stats_key: str,
    actor: Annotated[UserContext, Depends(require_permission(PERM_READ))],
) -> ProductionStatsProbeOut | JSONResponse:
    try:
        return cat06_service.get_production_stats(stats_key, actor)
    except Cat06Error as exc:
        return _cat06_error(exc)


@router.get("/catalog/production-stats/m11-probe", response_model=None)
def cat06_m11_probe(
    actor: Annotated[UserContext, Depends(require_permission(PERM_READ))],
) -> JSONResponse:
    from app.governance.catalog.cat06.handler import run_cat06_catalog_probe

    out = run_cat06_catalog_probe(actor)
    return JSONResponse(status_code=200, content=out.model_dump(by_alias=True, mode="json"))


@router.get("/catalog/workno-behavior/m12-probe", response_model=None)
def cat07_m12_probe(
    actor: Annotated[UserContext, Depends(require_permission(PERM_READ))],
) -> JSONResponse:
    from app.governance.catalog.cat07.handler import run_cat07_catalog_probe

    out = run_cat07_catalog_probe(actor)
    return JSONResponse(status_code=200, content=out.model_dump(by_alias=True, mode="json"))


def _cat01_error(exc: Cat01Error) -> JSONResponse:
    detail = {"fields": exc.fields} if exc.fields else None
    return JSONResponse(status_code=exc.status, content={"code": exc.code, "message": exc.message, "detail": detail})


@router.post("/catalog/lifecycle-templates/validate", response_model=LifecycleTemplateValidateOut)
def lifecycle_templates_validate(
    payload: LifecycleTemplateIn,
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
) -> LifecycleTemplateValidateOut | JSONResponse:
    try:
        return cat01_service.validate_lifecycle_template(payload)
    except Cat01Error as exc:
        return _cat01_error(exc)


@router.post("/catalog/lifecycle-templates", response_model=LifecycleTemplateOut, status_code=status.HTTP_201_CREATED)
def lifecycle_templates_create(
    payload: LifecycleTemplateIn,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
) -> LifecycleTemplateOut | JSONResponse:
    try:
        return cat01_service.create_lifecycle_template(payload, actor)
    except Cat01Error as exc:
        return _cat01_error(exc)


@router.get("/catalog/lifecycle-templates/m6-probe", response_model=None)
def cat01_m6_probe(
    actor: Annotated[UserContext, Depends(require_permission(PERM_READ))],
) -> JSONResponse:
    from app.governance.catalog.cat01.handler import run_cat01_catalog_probe

    out = run_cat01_catalog_probe(actor)
    return JSONResponse(status_code=200, content=out.model_dump(by_alias=True, mode="json"))


@router.get("/catalog/lifecycle-templates/{template_key}", response_model=LifecycleTemplateOut)
def lifecycle_templates_get(
    template_key: str,
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
) -> LifecycleTemplateOut | JSONResponse:
    try:
        return cat01_service.get_lifecycle_template(template_key)
    except Cat01Error as exc:
        return _cat01_error(exc)


@router.get("/catalog/lifecycle-templates", response_model=LifecycleTemplateListResponse)
def lifecycle_templates_list(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    actor: Annotated[UserContext, Depends(require_permission(PERM_READ))] = None,
) -> LifecycleTemplateListResponse:
    return cat01_service.list_lifecycle_templates(limit, offset, actor)


@router.post("/catalog/lifecycle-templates/{template_key}/stages/move", response_model=LifecycleTemplateOut)
def lifecycle_templates_stage_move(
    template_key: str,
    payload: LifecycleStageMove,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
) -> LifecycleTemplateOut | JSONResponse:
    try:
        return cat01_service.move_lifecycle_stage(template_key, payload, actor)
    except Cat01Error as exc:
        return _cat01_error(exc)


def _cat02_error(exc: Cat02Error) -> JSONResponse:
    detail = {"fields": exc.fields} if exc.fields else None
    return JSONResponse(status_code=exc.status, content={"code": exc.code, "message": exc.message, "detail": detail})


@router.post("/catalog/aggregate-templates/validate", response_model=AggregateTemplateValidateOut)
def aggregate_templates_validate(
    payload: AggregateTemplateIn,
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
) -> AggregateTemplateValidateOut | JSONResponse:
    try:
        return cat02_service.validate_aggregate_template(payload)
    except Cat02Error as exc:
        return _cat02_error(exc)


@router.post("/catalog/aggregate-templates", response_model=AggregateTemplateOut, status_code=status.HTTP_201_CREATED)
def aggregate_templates_create(
    payload: AggregateTemplateIn,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
) -> AggregateTemplateOut | JSONResponse:
    try:
        return cat02_service.create_aggregate_template(payload, actor)
    except Cat02Error as exc:
        return _cat02_error(exc)


@router.get("/catalog/aggregate-templates", response_model=AggregateTemplateListResponse)
def aggregate_templates_list(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    actor: Annotated[UserContext, Depends(require_permission(PERM_READ))] = None,
) -> AggregateTemplateListResponse:
    return cat02_service.list_aggregate_templates(limit, offset, actor)


@router.get("/catalog/aggregate-templates/m6-probe", response_model=None)
def cat02_m6_probe(
    actor: Annotated[UserContext, Depends(require_permission(PERM_READ))],
) -> JSONResponse:
    from app.governance.catalog.cat02.handler import run_cat02_catalog_probe

    out = run_cat02_catalog_probe(actor)
    return JSONResponse(status_code=200, content=out.model_dump(by_alias=True, mode="json"))


@router.get("/catalog/aggregate-templates/{aggregate_key}/attribution", response_model=AggregateAttributionOut)
def aggregate_templates_attribution(
    aggregate_key: str,
    actor: Annotated[UserContext, Depends(require_permission(PERM_READ))],
) -> AggregateAttributionOut | JSONResponse:
    try:
        return cat02_service.get_aggregate_attribution(aggregate_key, actor)
    except Cat02Error as exc:
        return _cat02_error(exc)
