from __future__ import annotations

import time
import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.designer.schemas import DesignerError, DesignerSubmitWorkflowIn, DesignerSubmitWorkflowOut
from app.designer import snapshot as snapshot_service
from app.governance.publish import service as publish_service
from app.governance.workflow import service as workflow_service
from app.governance.workflow.schemas import WorkflowInstanceCreateIn
from app.query.config_store import service as config_store
from app.query.config_store.schemas import ConfigError, ConfigUpsert

_CONFIG_TYPE = "designer_workflow_link"
_REF_TYPE = "designer"

probe_validate_workflow_link_budget_ms_limit = 50


class DesignerWorkflowLinkIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    designer_item_id: uuid.UUID = Field(alias="designerItemId")
    workflow_instance_id: uuid.UUID = Field(alias="workflowInstanceId")
    catalog_entry_id: uuid.UUID | None = Field(default=None, alias="catalogEntryId")
    design_type: Literal["chart", "report", "query"] = Field(default="chart", alias="designType")


class DesignerWorkflowLinkValidateOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    valid: bool = True
    publish_ready: bool = Field(alias="publishReady")


class DesignerWorkflowLinkOut(DesignerWorkflowLinkIn):
    publish_ready: bool = Field(default=False, alias="publishReady")


def _workflow_status(session: Session, instance_id: uuid.UUID) -> str:
    try:
        return workflow_service.get_instance(session, instance_id).status
    except Exception as exc:
        raise DesignerError("DESIGN_WORKFLOW_INSTANCE_NOT_FOUND", "Workflow instance not found", 404) from exc


def _compute_publish_ready(session: Session, link: DesignerWorkflowLinkIn) -> bool:
    status = _workflow_status(session, link.workflow_instance_id)
    if status != "published":
        return False
    if link.catalog_entry_id is None:
        return True
    try:
        return publish_service.get_publish_status(session, link.catalog_entry_id).status == "published"
    except Exception:
        return False


def validate_workflow_link(session: Session, link: DesignerWorkflowLinkIn) -> DesignerWorkflowLinkValidateOut:
    if link.design_type == "query" and link.catalog_entry_id is not None:
        raise DesignerError(
            "DESIGN_WORKFLOW_CATALOG_MISMATCH",
            "query designType must not include catalogEntryId",
            422,
            fields=[{"field": "catalogEntryId", "message": "not allowed for query designType"}],
        )
    if not str(link.designer_item_id):
        raise DesignerError("DESIGN_WORKFLOW_INVALID_ITEM", "designerItemId required", 422)
    _workflow_status(session, link.workflow_instance_id)
    return DesignerWorkflowLinkValidateOut(publishReady=_compute_publish_ready(session, link))


def save_workflow_link(session: Session, link: DesignerWorkflowLinkIn, owner_id: uuid.UUID | None) -> DesignerWorkflowLinkOut:
    validate_workflow_link(session, link)
    config_store.upsert_config(
        session,
        ConfigUpsert(
            config_type=_CONFIG_TYPE,
            schema_version="1.0",
            ref_type=_REF_TYPE,
            ref_id=link.designer_item_id,
            payload=link.model_dump(by_alias=True, mode="json"),
        ),
        owner_id=owner_id,
    )
    return get_workflow_link(session, link.designer_item_id)


def get_workflow_link(session: Session, designer_item_id: uuid.UUID) -> DesignerWorkflowLinkOut:
    try:
        record = config_store.get_config_by_ref(session, _CONFIG_TYPE, _REF_TYPE, designer_item_id)
    except ConfigError as exc:
        raise DesignerError("DESIGN_WORKFLOW_LINK_NOT_FOUND", "Workflow link not found", 404) from exc
    link = DesignerWorkflowLinkIn.model_validate(record.payload)
    return DesignerWorkflowLinkOut(
        **link.model_dump(),
        publishReady=_compute_publish_ready(session, link),
    )


def get_link_by_instance(session: Session, workflow_instance_id: uuid.UUID) -> DesignerWorkflowLinkOut:
    records = config_store.list_configs_by_type(session, _CONFIG_TYPE)
    for rec in records:
        link = DesignerWorkflowLinkIn.model_validate(rec.payload)
        if link.workflow_instance_id == workflow_instance_id:
            return DesignerWorkflowLinkOut(
                **link.model_dump(),
                publishReady=_compute_publish_ready(session, link),
            )
    raise DesignerError("DESIGN_WORKFLOW_LINK_NOT_FOUND", "Workflow link not found", 404)


def delete_workflow_link(session: Session, designer_item_id: uuid.UUID, actor: UserContext) -> None:
    link = get_workflow_link(session, designer_item_id)
    status = _workflow_status(session, link.workflow_instance_id)
    if status != "draft":
        raise DesignerError(
            "DESIGN_WORKFLOW_LINK_NOT_REVOKABLE",
            "Link can only be revoked in draft status",
            409,
        )
    if not any(r in actor.roles for r in ("admin", "analyst")):
        raise DesignerError("DESIGN_SUBMIT_FORBIDDEN", "Revoke requires admin or analyst", 403)
    config_store.delete_config_by_ref(session, _CONFIG_TYPE, _REF_TYPE, designer_item_id)


def update_link_catalog_entry(
    session: Session, designer_item_id: uuid.UUID, catalog_entry_id: uuid.UUID
) -> None:
    record = config_store.get_config_by_ref(session, _CONFIG_TYPE, _REF_TYPE, designer_item_id)
    body = dict(record.payload)
    body["catalogEntryId"] = str(catalog_entry_id)
    config_store.upsert_config(
        session,
        ConfigUpsert(
            config_type=_CONFIG_TYPE,
            schema_version="1.0",
            ref_type=_REF_TYPE,
            ref_id=designer_item_id,
            payload=body,
        ),
    )


def probe_validate_workflow_link_budget_ms(session: Session, link: DesignerWorkflowLinkIn) -> float:
    started = time.perf_counter()
    validate_workflow_link(session, link)
    return (time.perf_counter() - started) * 1000


def _assert_submit_actor(actor: UserContext) -> None:
    if not any(r in actor.roles for r in ("admin", "analyst")):
        raise DesignerError("DESIGN_SUBMIT_FORBIDDEN", "Submit requires admin or analyst role", 403)


def _assert_design_complete(session: Session, designer_item_id: uuid.UUID) -> None:
    from app.designer import service as designer_service
    from app.designer import output_fields as output_fields_service
    from app.designer import sql_mode as sql_mode_service

    mode = sql_mode_service.get_design_mode(session, "design_draft", designer_item_id)
    if mode == "sql":
        try:
            sql_mode_service.get_sql_mode(session, "design_draft", designer_item_id)
        except ConfigError as exc:
            raise DesignerError("DESIGN_SUBMIT_INCOMPLETE", "SQL mode configuration incomplete", 422) from exc
        return
    try:
        designer_service.get_conditions(session, "design_draft", designer_item_id)
        designer_service.get_compute_rules(session, "design_draft", designer_item_id)
        output_fields_service.get_output_fields(session, "design_draft", designer_item_id)
    except ConfigError as exc:
        raise DesignerError("DESIGN_SUBMIT_INCOMPLETE", "Designer configuration incomplete", 422) from exc


def submit_with_snapshot(
    session: Session,
    payload: DesignerSubmitWorkflowIn,
    actor: UserContext,
) -> DesignerSubmitWorkflowOut:
    _assert_submit_actor(actor)
    if payload.design_type == "query" and payload.catalog_entry_id is not None:
        raise DesignerError(
            "DESIGN_WORKFLOW_CATALOG_MISMATCH",
            "query designType must not include catalogEntryId",
            422,
        )
    _assert_design_complete(session, payload.designer_item_id)
    owner_id: uuid.UUID | None = None
    try:
        owner_id = uuid.UUID(actor.id)
    except ValueError:
        pass
    snapshot_id, snap_payload = snapshot_service.capture_snapshot(session, payload.designer_item_id, owner_id)
    instance = workflow_service.create_instance(
        session,
        WorkflowInstanceCreateIn(templateId=payload.template_id, refId=payload.designer_item_id),
    )
    record = config_store.get_config_by_ref(session, "workflow_instance", "workflow", instance.id)
    body = dict(record.payload)
    body["designSnapshotId"] = str(snapshot_id)
    body["snapshotRevision"] = snap_payload.get("revisions", {})
    config_store.upsert_config(
        session,
        ConfigUpsert(
            config_type="workflow_instance",
            schema_version="1.0",
            ref_type="workflow",
            ref_id=instance.id,
            payload=body,
        ),
    )
    link = DesignerWorkflowLinkIn(
        designerItemId=payload.designer_item_id,
        workflowInstanceId=instance.id,
        catalogEntryId=payload.catalog_entry_id,
        designType=payload.design_type,
    )
    save_workflow_link(session, link, owner_id)
    transitioned = workflow_service.transition_instance(session, instance.id, "submit", "requester")
    return DesignerSubmitWorkflowOut(
        workflowInstanceId=instance.id,
        designSnapshotId=snapshot_id,
        status=transitioned.status,
        publishReady=False,
    )
