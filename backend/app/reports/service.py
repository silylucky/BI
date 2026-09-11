"""Unified report center use-case orchestrator."""

from __future__ import annotations

import uuid
from typing import Any

from app.auth.deps import UserContext
from app.reports import center_prefs
from app.reports.catalog import service as catalog_service
from app.reports.catalog.schemas import CatalogNodeCreate, CatalogNodeOut
from app.reports.engine.schemas import RenderRunIn, RenderRunOut
from app.reports.engine import service as engine_service
from app.reports.extension import service as extension_service
from app.reports.jobs import service as job_service
from app.reports.scheduler import service as scheduler_service
from app.reports.scheduler.errors import ScheduleError
from app.reports.scheduler.schemas import ScheduleCreate, ScheduleStatusOut, ScheduleUpdate
from app.reports.templates import service as template_service


def run_template(template_id: uuid.UUID, payload: RenderRunIn, actor: UserContext) -> RenderRunOut:
    center_prefs.record_recent_view(
        actor,
        resource_type="template",
        resource_id=str(template_id),
        resource_label=catalog_service.get_node(template_id).name,
    )
    return engine_service.run_template(template_id, payload, actor)


def duplicate_catalog_node(
    node_id: uuid.UUID,
    *,
    name: str | None,
    parent_id: uuid.UUID | None,
    actor: UserContext,
) -> CatalogNodeOut:
    from app.reports.persistence import template_repo
    from app.reports.templates.schemas import TemplateDefinitionIn

    source = catalog_service.get_node(node_id)
    new_template_key = None
    if source.template_key:
        raw = template_repo.get_template(source.template_key)
        if raw is not None:
            new_template_key = f"{source.template_key}-copy-{uuid.uuid4().hex[:6]}"
            template_service.upsert_template_definition(
                new_template_key,
                TemplateDefinitionIn.model_validate({**raw, "templateKey": new_template_key}),
                actor,
            )
    payload = CatalogNodeCreate(
        name=name or f"{source.name}（副本）",
        parentId=parent_id if parent_id is not None else source.parent_id,
        nodeType=source.node_type,
        templateKind=source.template_kind,
        templateKey=new_template_key or source.template_key,
        sortOrder=source.sort_order + 1,
    )
    created = catalog_service.create_node(payload, actor)
    if source.node_type == "template":
        from app.reports.errors import ReportExtensionError

        try:
            ext = extension_service.get_extension(node_id)
        except ReportExtensionError:
            ext = None
        if ext is not None:
            from app.reports.extension.schemas import ExtensionConfigUpsert

            extension_service.upsert(
                created.id,
                ExtensionConfigUpsert.model_validate(ext.model_dump()),
                actor,
            )
    center_prefs.record_recent_view(
        actor,
        resource_type="template",
        resource_id=str(created.id),
        resource_label=created.name,
    )
    return created


def publish_template(template_key: str, actor: UserContext, *, change_note: str | None = None) -> dict:
    from app.reports.templates import versions as template_versions

    return template_versions.publish(template_key, actor, change_note=change_note)


def submit_batch_export(node_ids: list[uuid.UUID], fmt: str, actor: UserContext) -> dict:
    return job_service.submit_batch_export_job(owner_id=actor.id, node_ids=node_ids, fmt=fmt)


def revise_schedule(
    schedule_id: uuid.UUID,
    payload: ScheduleUpdate,
    actor: UserContext,
) -> ScheduleStatusOut:
    """Clone active schedule into a new draft revision for safe editing."""
    row = scheduler_service._get_row(schedule_id)
    if row["status"] not in {"scheduled", "paused"}:
        raise ScheduleError(
            "RPT_SCHEDULE_NOT_REVISABLE",
            "Only scheduled or paused schedules can be revised",
            400,
        )
    create_payload = ScheduleCreate(
        catalogNodeId=row.get("catalog_node_id"),
        sourceType=row.get("source_type", "template"),
        sourceId=row.get("source_id"),
        recipients=row.get("recipients") or [],
        attachmentFormats=row.get("attachment_formats") or ["pdf"],
        deliveryChannels=["email"],
        emailSmtpSlot=row.get("email_smtp_slot") or "qq",
        name=(payload.name or row.get("name") or "定时报告") + "（修订）",
        cron=payload.cron or row["cron"],
        timezone=payload.timezone or row["timezone"],
    )
    draft = scheduler_service.create_schedule(create_payload, actor)
    if payload.recipients is not None:
        scheduler_service.update_schedule(
            draft.id,
            ScheduleUpdate(recipients=payload.recipients),
            actor,
        )
    if payload.attachment_formats is not None:
        scheduler_service.update_schedule(
            draft.id,
            ScheduleUpdate(attachmentFormats=payload.attachment_formats),
            actor,
        )
    if payload.delivery_channels is not None:
        scheduler_service.update_schedule(
            draft.id,
            ScheduleUpdate(deliveryChannels=payload.delivery_channels),
            actor,
        )
    return draft


def get_center_preferences(actor: UserContext) -> dict[str, Any]:
    return center_prefs.get_preferences(actor).model_dump(by_alias=True)
