"""Custom workflow template persistence (GOV-003 r245)."""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.governance.workflow.errors import WorkflowError
from app.governance.workflow.schemas import WorkflowTemplateOut
from app.query.config_store import service as config_store
from app.query.config_store.models import QueryConfigRecord
from app.query.config_store.schemas import ConfigUpsert

_TEMPLATE_CONFIG_TYPE = "workflow_template"
_REF_TYPE = "workflow_template"


def _template_ref_id(template_id: str) -> uuid.UUID:
    return uuid.uuid5(uuid.NAMESPACE_URL, f"vitalspan:workflow_template:{template_id}")


def _load_custom_templates(session: Session) -> dict[str, WorkflowTemplateOut]:
    records, _ = config_store.list_configs(session, config_type=_TEMPLATE_CONFIG_TYPE)
    out: dict[str, WorkflowTemplateOut] = {}
    for rec in records:
        tpl = WorkflowTemplateOut.model_validate(rec.payload)
        out[tpl.id] = tpl
    return out


def get_custom_template(session: Session, template_id: str) -> WorkflowTemplateOut | None:
    return _load_custom_templates(session).get(template_id)


def save_custom_template(session: Session, template: WorkflowTemplateOut) -> WorkflowTemplateOut:
    config_store.upsert_config(
        session,
        ConfigUpsert(
            config_type=_TEMPLATE_CONFIG_TYPE,
            schema_version="1.0",
            ref_type=_REF_TYPE,
            ref_id=_template_ref_id(template.id),
            payload=template.model_dump(by_alias=True),
        ),
    )
    return template


def delete_custom_template(session: Session, template_id: str) -> None:
    ref_id = _template_ref_id(template_id)
    stmt = select(QueryConfigRecord).where(
        QueryConfigRecord.config_type == _TEMPLATE_CONFIG_TYPE,
        QueryConfigRecord.ref_type == _REF_TYPE,
        QueryConfigRecord.ref_id == ref_id,
    )
    record = session.scalar(stmt)
    if record is None:
        raise WorkflowError("GOV_WORKFLOW_TEMPLATE_NOT_FOUND", "Template not found", 404)
    session.delete(record)
    session.commit()


def template_in_use(session: Session, template_id: str) -> bool:
    records, _ = config_store.list_configs(session, config_type="workflow_instance")
    return any(r.payload.get("templateId") == template_id for r in records)
