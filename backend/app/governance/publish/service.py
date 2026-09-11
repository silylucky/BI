from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.core.nfr.errors import (
    GOV_PUBLISH_ALREADY_PENDING,
    GOV_PUBLISH_ENTRY_NOT_FOUND,
    GOV_PUBLISH_INVALID_TRANSITION,
)
from app.designer import workflow as workflow_link_service
from app.governance.catalog import service as catalog_service
from app.governance.catalog.schemas import CatalogEntryCreate
from app.governance.catalog.models import CatalogEntry
from app.governance.acl import assert_publish_action, record_publish_submitter
from app.governance.publish.errors import PublishError
from app.governance.publish.notifications import emit_publish_notification
from app.governance.publish.schemas import PublishActionOut, PublishFromWorkflowOut, PublishStatusOut
from app.governance.workflow import service as workflow_service
from app.query.config_store import service as config_store
from app.query.config_store.schemas import ConfigUpsert

_ALLOWED: dict[str, frozenset[str]] = {
    "draft": frozenset({"submit"}),
    "pending_publish": frozenset({"approve", "reject"}),
    "published": frozenset(),
}


def _get_row(db: Session, entry_id: uuid.UUID) -> CatalogEntry:
    row = db.scalar(select(CatalogEntry).where(CatalogEntry.id == entry_id))
    if row is None:
        raise PublishError(GOV_PUBLISH_ENTRY_NOT_FOUND, "Catalog entry not found", 404)
    return row


def get_publish_status(db: Session, entry_id: uuid.UUID) -> PublishStatusOut:
    row = _get_row(db, entry_id)
    return PublishStatusOut(
        id=row.id,
        status=row.status,
        allowedActions=sorted(_ALLOWED.get(row.status, frozenset())),
    )


def submit_entry(
    db: Session, entry_id: uuid.UUID, actor: UserContext | None = None
) -> PublishActionOut:
    if actor is not None:
        assert_publish_action(db, actor, "submit", entry_id)
    row = _get_row(db, entry_id)
    if row.status == "pending_publish":
        raise PublishError(GOV_PUBLISH_ALREADY_PENDING, "Entry already pending publish", 409)
    if row.status != "draft":
        raise PublishError(GOV_PUBLISH_INVALID_TRANSITION, f"Cannot submit from {row.status}", 400)
    row.status = "pending_publish"
    db.commit()
    db.refresh(row)
    if actor is not None:
        record_publish_submitter(db, entry_id, actor.id)
    emit_publish_notification(entry_id, "submitted")
    return PublishActionOut(id=row.id, status=row.status)


def approve_entry(
    db: Session, entry_id: uuid.UUID, actor: UserContext | None = None
) -> PublishActionOut:
    if actor is not None:
        assert_publish_action(db, actor, "approve", entry_id)
    row = _get_row(db, entry_id)
    if row.status == "published":
        return PublishActionOut(id=row.id, status=row.status)
    if row.status != "pending_publish":
        raise PublishError(GOV_PUBLISH_INVALID_TRANSITION, f"Cannot approve from {row.status}", 400)
    row.status = "published"
    db.commit()
    db.refresh(row)
    emit_publish_notification(entry_id, "approved")
    bus_status: str | None = None
    bus_error: str | None = None
    if actor is not None:
        from app.governance.bus.pipeline import attempt_auto_bus_register_for_publish

        outcome = attempt_auto_bus_register_for_publish(db, actor, entry_id)
        bus_status = outcome.status
        bus_error = outcome.error_code
    return PublishActionOut(
        id=row.id,
        status=row.status,
        bus_register_status=bus_status,
        bus_register_error_code=bus_error,
    )


def reject_entry(
    db: Session, entry_id: uuid.UUID, actor: UserContext | None = None
) -> PublishActionOut:
    if actor is not None:
        assert_publish_action(db, actor, "reject", entry_id)
    row = _get_row(db, entry_id)
    if row.status != "pending_publish":
        raise PublishError(GOV_PUBLISH_INVALID_TRANSITION, f"Cannot reject from {row.status}", 400)
    row.status = "draft"
    db.commit()
    db.refresh(row)
    emit_publish_notification(entry_id, "rejected")
    return PublishActionOut(id=row.id, status=row.status)


def _version_history(db: Session, entry_id: uuid.UUID) -> list[dict]:
    try:
        rec = config_store.get_config_by_ref(db, "publish_version_history", "catalog", entry_id)
        return list(rec.payload.get("history", []))
    except Exception:
        return []


def _append_version_history(db: Session, entry_id: uuid.UUID, status: str) -> list[dict]:
    history = _version_history(db, entry_id)
    history.append({"publishVersion": len(history) + 1, "status": status})
    config_store.upsert_config(
        db,
        ConfigUpsert(
            config_type="publish_version_history",
            schema_version="1.0",
            ref_type="catalog",
            ref_id=entry_id,
            payload={"history": history},
        ),
    )
    return history


def rollback_entry_skeleton(db: Session, entry_id: uuid.UUID) -> PublishActionOut:
    row = _get_row(db, entry_id)
    _append_version_history(db, entry_id, row.status)
    if row.status == "published":
        _release_publish_refs(entry_id)
    row.status = "draft"
    db.commit()
    db.refresh(row)
    return PublishActionOut(id=row.id, status=row.status)


def _release_publish_refs(entry_id: uuid.UUID) -> None:
    from app.governance.openapi import service as openapi_service
    from app.metadata.physical import gov_refs as physical_gov_refs

    openapi_service.release_entity_refs_for_catalog(entry_id)
    physical_gov_refs.release_catalog_refs_for_entry(str(entry_id))


def unpublish_entry(
    db: Session, entry_id: uuid.UUID, actor: UserContext | None = None
) -> PublishActionOut:
    if actor is not None:
        assert_publish_action(db, actor, "approve", entry_id)
    row = _get_row(db, entry_id)
    if row.status != "published":
        raise PublishError(GOV_PUBLISH_INVALID_TRANSITION, f"Cannot unpublish from {row.status}", 400)
    _append_version_history(db, entry_id, row.status)
    _release_publish_refs(entry_id)
    row.status = "draft"
    db.commit()
    db.refresh(row)
    emit_publish_notification(entry_id, "unpublished")
    return PublishActionOut(id=row.id, status=row.status)


def publish_from_workflow(
    db: Session, workflow_instance_id: uuid.UUID, actor: UserContext
) -> PublishFromWorkflowOut:
    link = workflow_link_service.get_link_by_instance(db, workflow_instance_id)
    if link.catalog_entry_id is not None:
        return PublishFromWorkflowOut(
            catalogEntryId=link.catalog_entry_id,
            publishVersion=len(_version_history(db, link.catalog_entry_id)) or 1,
            idempotent=True,
        )
    inst = workflow_service.get_instance(db, workflow_instance_id)
    if inst.status != "pending_publish":
        raise PublishError("GOV_PUBLISH_INVALID_STATE", "Instance must be pending_publish", 400)
    if not any(r in actor.roles for r in ("admin", "publisher")):
        raise PublishError("GOV_PUBLISH_FORBIDDEN", "Publish requires publisher or admin", 403)
    slug = f"query_{str(inst.ref_id)[:8].replace('-', '_')}"
    entry = catalog_service.create_entry(
        db,
        CatalogEntryCreate(
            name=f"Query {slug}",
            path=f"/api/v1/services/{slug}",
            httpMethod="POST",
            categoryCodes=["CAT-02"],
        ),
    )
    workflow_link_service.update_link_catalog_entry(db, link.designer_item_id, entry.id)
    submit_entry(db, entry.id, actor)
    approve_entry(db, entry.id, actor)
    _append_version_history(db, entry.id, "published")
    from app.governance.openapi import service as openapi_service

    openapi_service.generate_openapi_document(db, entry.id)
    workflow_service.transition_instance(db, workflow_instance_id, "publish", "publisher")
    return PublishFromWorkflowOut(
        catalogEntryId=entry.id,
        publishVersion=1,
        idempotent=False,
    )
