"""Designer configuration snapshots (DESIGN-004)."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.designer import service as designer_service
from app.designer import output_fields as output_fields_service
from app.designer.schemas import DesignerError
from app.query.config_store import service as config_store
from app.query.config_store.schemas import ConfigUpsert

_CONFIG_TYPE = "designer_snapshot"
_REF_TYPE = "designer"


def capture_snapshot(
    session: Session,
    designer_item_id: uuid.UUID,
    owner_id: uuid.UUID | None,
) -> tuple[uuid.UUID, dict]:
    conditions = designer_service.get_conditions(session, "design_draft", designer_item_id)
    rules = designer_service.get_compute_rules(session, "design_draft", designer_item_id)
    output = output_fields_service.get_output_fields(session, "design_draft", designer_item_id)

    def _revision(config_type: str) -> int:
        try:
            rec = config_store.get_config_by_ref(session, config_type, "design_draft", designer_item_id)
            return rec.revision
        except Exception:
            return 0

    snapshot_id = uuid.uuid4()
    payload = {
        "conditions": designer_service._conditions_payload(conditions),
        "computeRules": designer_service._rules_payload(rules),
        "outputFields": output_fields_service._output_payload(output),
        "revisions": {
            "query_conditions": _revision("query_conditions"),
            "compute_rules": _revision("compute_rules"),
            "output_fields": _revision("output_fields"),
        },
        "capturedAt": datetime.now(timezone.utc).isoformat(),
    }
    config_store.upsert_config(
        session,
        ConfigUpsert(
            config_type=_CONFIG_TYPE,
            schema_version="1.0",
            ref_type=_REF_TYPE,
            ref_id=snapshot_id,
            payload=payload,
        ),
        owner_id=owner_id,
    )
    return snapshot_id, payload


def get_snapshot(session: Session, snapshot_id: uuid.UUID) -> dict:
    record = config_store.get_config_by_ref(session, _CONFIG_TYPE, _REF_TYPE, snapshot_id)
    return record.payload


def assert_snapshot_readable(session: Session, snapshot_id: uuid.UUID, actor: UserContext) -> None:
    if actor.is_root:
        return
    record = config_store.get_config_by_ref(session, _CONFIG_TYPE, _REF_TYPE, snapshot_id)
    if record.owner_id is None:
        return
    try:
        actor_uuid = uuid.UUID(actor.id)
    except ValueError:
        raise DesignerError("DESIGN_SNAPSHOT_FORBIDDEN", "Snapshot access denied", 403)
    if record.owner_id != actor_uuid:
        raise DesignerError("DESIGN_SNAPSHOT_FORBIDDEN", "Snapshot access denied", 403)


def get_snapshot_for_actor(session: Session, snapshot_id: uuid.UUID, actor: UserContext) -> dict:
    assert_snapshot_readable(session, snapshot_id, actor)
    return get_snapshot(session, snapshot_id)
