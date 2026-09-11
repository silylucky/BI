from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.governance.workflow.errors import WorkflowError
from app.governance.workflow.node_roles import _REQUIRED_TEMPLATE_NODES
from app.governance.workflow.schemas import (
    ALLOWED_NODE_ROLES,
    WorkflowInstanceCreateIn,
    WorkflowInstanceListOut,
    WorkflowInstanceOut,
    WorkflowTemplateCreateIn,
    WorkflowTemplateOut,
    WorkflowTemplateUpdateIn,
    WorkflowTemplateValidateIn,
)
from app.governance.workflow import templates_store
from app.query.config_store import service as config_store
from app.query.config_store.schemas import ConfigUpsert

_BUILTIN_IDS = frozenset({"standard_query_release"})

_BUILTIN_TEMPLATES: dict[str, WorkflowTemplateOut] = {
    "standard_query_release": WorkflowTemplateOut(
        id="standard_query_release",
        name="标准查询发布流程",
        nodes=[
            {"id": "draft", "role": "requester"},
            {"id": "pending_approval", "role": "approver"},
            {"id": "designing", "role": "designer"},
            {"id": "pending_publish", "role": "publisher"},
            {"id": "published", "role": "publisher"},
        ],
    )
}

_TRANSITIONS: dict[str, dict[str, tuple[str, str]]] = {
    "draft": {"submit": ("pending_approval", "requester")},
    "pending_approval": {
        "approve": ("designing", "approver"),
        "reject": ("draft", "approver"),
    },
    "designing": {"complete_design": ("pending_publish", "designer")},
    "pending_publish": {"publish": ("published", "publisher")},
    "published": {},
}


def list_templates(session: Session) -> list[WorkflowTemplateOut]:
    return list(_BUILTIN_TEMPLATES.values()) + list(templates_store._load_custom_templates(session).values())


def get_template(session: Session, template_id: str) -> WorkflowTemplateOut:
    if template_id in _BUILTIN_TEMPLATES:
        return _BUILTIN_TEMPLATES[template_id]
    custom = templates_store.get_custom_template(session, template_id)
    if custom is None:
        raise WorkflowError("GOV_WORKFLOW_TEMPLATE_NOT_FOUND", "Template not found", 404)
    return custom


def create_template(session: Session, payload: WorkflowTemplateCreateIn) -> WorkflowTemplateOut:
    tpl_id = f"custom_{uuid.uuid4().hex[:12]}"
    candidate = WorkflowTemplateValidateIn(id=tpl_id, name=payload.name, nodes=payload.nodes)
    validated = validate_template(candidate)
    for node in validated.nodes:
        if node.role not in ALLOWED_NODE_ROLES:
            raise WorkflowError(
                "GOV_WORKFLOW_INVALID_TEMPLATE",
                f"Invalid role: {node.role}",
                422,
            )
    templates_store.save_custom_template(session, validated)
    return validated


def update_template(
    session: Session, template_id: str, payload: WorkflowTemplateUpdateIn
) -> WorkflowTemplateOut:
    if template_id in _BUILTIN_IDS:
        raise WorkflowError("GOV_WORKFLOW_BUILTIN_READONLY", "Builtin template readonly", 403)
    existing = templates_store.get_custom_template(session, template_id)
    if existing is None:
        raise WorkflowError("GOV_WORKFLOW_TEMPLATE_NOT_FOUND", "Template not found", 404)
    name = payload.name if payload.name is not None else existing.name
    nodes = payload.nodes if payload.nodes is not None else existing.nodes
    validated = validate_template(WorkflowTemplateValidateIn(id=template_id, name=name, nodes=nodes))
    for node in validated.nodes:
        if node.role not in ALLOWED_NODE_ROLES:
            raise WorkflowError("GOV_WORKFLOW_INVALID_TEMPLATE", f"Invalid role: {node.role}", 422)
    templates_store.save_custom_template(session, validated)
    return validated


def delete_template(session: Session, template_id: str) -> None:
    if template_id in _BUILTIN_IDS:
        raise WorkflowError("GOV_WORKFLOW_BUILTIN_READONLY", "Builtin template readonly", 403)
    if templates_store.template_in_use(session, template_id):
        raise WorkflowError("GOV_WORKFLOW_TEMPLATE_IN_USE", "Template referenced by instances", 409)
    templates_store.delete_custom_template(session, template_id)


def validate_template(payload: WorkflowTemplateValidateIn) -> WorkflowTemplateOut:
    node_ids = [n.id for n in payload.nodes]
    if len(node_ids) != len(set(node_ids)):
        raise WorkflowError("GOV_WORKFLOW_INVALID_TEMPLATE", "Duplicate node ids", 422)
    if any(not n.role.strip() for n in payload.nodes):
        raise WorkflowError("GOV_WORKFLOW_INVALID_TEMPLATE", "Node role required", 422)
    node_id_set = {n.id for n in payload.nodes}
    missing = sorted(_REQUIRED_TEMPLATE_NODES - node_id_set)
    if missing:
        raise WorkflowError(
            "GOV_WORKFLOW_INVALID_TEMPLATE",
            "Template missing required nodes",
            422,
            detail={"missingNodes": missing},
        )
    return WorkflowTemplateOut(id=payload.id, name=payload.name, nodes=payload.nodes)


def _allowed_actions(status: str) -> list[str]:
    return sorted(_TRANSITIONS.get(status, {}).keys())


def _load_instance_payload(session: Session, instance_id: uuid.UUID) -> dict:
    record = config_store.get_config_by_ref(session, "workflow_instance", "workflow", instance_id)
    return record.payload


def _to_instance_out(rec) -> WorkflowInstanceOut:
    body = rec.payload
    return WorkflowInstanceOut(
        id=rec.ref_id,
        templateId=body["templateId"],
        refId=uuid.UUID(body["refId"]),
        status=body["status"],
        allowedActions=_allowed_actions(body["status"]),
        snapshotRevision=body.get("snapshotRevision"),
    )


def list_instances(
    session: Session,
    *,
    limit: int = 50,
    offset: int = 0,
    status: str | None = None,
) -> WorkflowInstanceListOut:
    records = config_store.list_configs_by_type(session, "workflow_instance")
    items = []
    for rec in sorted(records, key=lambda r: r.payload.get("capturedAt", str(r.updated_at)), reverse=True):
        inst = _to_instance_out(rec)
        if status and inst.status != status:
            continue
        items.append(inst)
    page = items[offset : offset + limit]
    return WorkflowInstanceListOut(items=page, total=len(items))


def create_instance(session: Session, payload: WorkflowInstanceCreateIn) -> WorkflowInstanceOut:
    get_template(session, payload.template_id)
    instance_id = uuid.uuid4()
    body = {
        "templateId": payload.template_id,
        "refId": str(payload.ref_id),
        "status": "draft",
        "history": [],
    }
    config_store.upsert_config(
        session,
        ConfigUpsert(
            config_type="workflow_instance",
            schema_version="1.0",
            ref_type="workflow",
            ref_id=instance_id,
            payload=body,
        ),
    )
    return WorkflowInstanceOut(
        id=instance_id,
        templateId=payload.template_id,
        refId=payload.ref_id,
        status="draft",
        allowedActions=_allowed_actions("draft"),
    )


def get_instance(
    session: Session,
    instance_id: uuid.UUID,
    include_snapshot: bool = False,
    actor=None,
) -> WorkflowInstanceOut:
    body = _load_instance_payload(session, instance_id)
    design_snapshot = None
    if include_snapshot and body.get("designSnapshotId"):
        from app.designer import snapshot as snapshot_service

        snap_id = uuid.UUID(body["designSnapshotId"])
        try:
            if actor is not None:
                design_snapshot = snapshot_service.get_snapshot_for_actor(session, snap_id, actor)
            else:
                design_snapshot = snapshot_service.get_snapshot(session, snap_id)
        except Exception:
            design_snapshot = None
    return WorkflowInstanceOut(
        id=instance_id,
        templateId=body["templateId"],
        refId=uuid.UUID(body["refId"]),
        status=body["status"],
        allowedActions=_allowed_actions(body["status"]),
        designSnapshot=design_snapshot,
        snapshotRevision=body.get("snapshotRevision"),
    )


def transition_instance(
    session: Session, instance_id: uuid.UUID, action: str, actor_role: str
) -> WorkflowInstanceOut:
    body = dict(_load_instance_payload(session, instance_id))
    status = body["status"]
    if status == "published":
        raise WorkflowError("GOV_WORKFLOW_ALREADY_TERMINAL", "Workflow already published", 409)
    if action == "submit" and status != "draft":
        raise WorkflowError("GOV_WORKFLOW_CONFLICT", "Instance already submitted", 409)
    rules = _TRANSITIONS.get(status, {})
    if action not in rules:
        raise WorkflowError("GOV_WORKFLOW_INVALID_TRANSITION", f"Cannot {action} from {status}", 400)
    next_status, required_role = rules[action]
    if actor_role != required_role:
        raise WorkflowError("GOV_WORKFLOW_FORBIDDEN_ROLE", f"Role {actor_role} cannot {action}", 403)
    body["status"] = next_status
    body.setdefault("history", []).append({"action": action, "from": status, "to": next_status, "role": actor_role})
    config_store.upsert_config(
        session,
        ConfigUpsert(
            config_type="workflow_instance",
            schema_version="1.0",
            ref_type="workflow",
            ref_id=instance_id,
            payload=body,
        ),
    )
    return WorkflowInstanceOut(
        id=instance_id,
        templateId=body["templateId"],
        refId=uuid.UUID(body["refId"]),
        status=next_status,
        allowedActions=_allowed_actions(next_status),
    )
