from __future__ import annotations

import re
import uuid

from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.datasources.models import get_meta_engine
from app.dashboard import service as dash_service
from app.reports.catalog import service as catalog_service
from app.reports.catalog.acl import register_node_owner
from app.reports.catalog.errors import ReportCatalogError
from app.reports.scheduler import acl as schedule_acl
from app.reports.scheduler import jobs as schedule_jobs
from app.reports.scheduler.errors import ScheduleError
from app.reports.scheduler.recipients import validate_recipients_present
from app.reports.scheduler.schemas import ScheduleCreate, ScheduleListOut, ScheduleStatusOut, ScheduleUpdate
from app.reports.scheduler.store import get_schedule_store
from app.core.platform_config.slots import normalize_email_slot
from app.reports.persistence import standard_repo
from app.reports.standard.errors import StandardAnalysisError
from app.reports.standard.service import get_pack

_ALLOWED: dict[str, frozenset[str]] = {
    "draft": frozenset({"schedule"}),
    "scheduled": frozenset({"pause", "cancel"}),
    "paused": frozenset({"resume", "cancel"}),
    "cancelled": frozenset(),
}
_TRANSITIONS: dict[str, dict[str, str]] = {
    "draft": {"schedule": "scheduled"},
    "scheduled": {"pause": "paused", "cancel": "cancelled"},
    "paused": {"resume": "scheduled", "cancel": "cancelled"},
}
_CRON_PART = re.compile(r"^[\d*,\-/]+$")


def _store():
    return get_schedule_store()


def _get_row(schedule_id: uuid.UUID) -> dict:
    row = _store().get(schedule_id)
    if row is None:
        raise ScheduleError("RPT_SCHEDULE_NOT_FOUND", "Schedule not found", 404)
    return row


def _validate_cron(cron: str) -> None:
    parts = cron.split()
    if len(parts) != 5 or not all(_CRON_PART.match(p) for p in parts):
        raise ScheduleError("RPT_SCHEDULE_INVALID_CRON", "Invalid cron expression", 422)
    ranges = [(0, 59), (0, 23), (1, 31), (1, 12), (0, 7)]
    for part, (lo, hi) in zip(parts, ranges, strict=True):
        if part.isdigit():
            val = int(part)
            if val < lo or val > hi:
                raise ScheduleError("RPT_SCHEDULE_INVALID_CRON", "Cron field out of range", 422)


def _source_label(row: dict) -> str | None:
    source_type = row.get("source_type", "template")
    if source_type == "standard":
        pack_key = row.get("source_key")
        if not pack_key:
            return None
        raw = standard_repo.get_pack(pack_key)
        if raw is None:
            return pack_key
        return raw.get("displayName") or pack_key
    source_id = row.get("source_id") or row.get("catalog_node_id")
    if source_id is None:
        return None
    try:
        if source_type == "template":
            node = catalog_service.get_node(source_id)
            return node.name
        if source_type in {"dashboard", "data_screen"}:
            with Session(bind=get_meta_engine()) as db:
                dash = dash_service.get_dashboard(db, source_id)
                return dash.name
    except Exception:
        return None
    return None


def _out(row: dict) -> ScheduleStatusOut:
    recipients = row.get("recipients") or []
    source_id = row.get("source_id") or row.get("catalog_node_id")
    return ScheduleStatusOut(
        id=row["id"],
        name=row.get("name"),
        catalogNodeId=row.get("catalog_node_id"),
        sourceType=row.get("source_type", "template"),
        sourceId=source_id,
        sourceKey=row.get("source_key"),
        sourceLabel=_source_label(row),
        recipients=recipients,
        attachmentFormats=row.get("attachment_formats") or ["pdf"],
        deliveryChannels=["email"],
        emailSmtpSlot=normalize_email_slot(row.get("email_smtp_slot")),
        cron=row["cron"],
        timezone=row["timezone"],
        status=row["status"],
        allowedActions=sorted(_ALLOWED.get(row["status"], frozenset())),
    )


def _assert_source_exists(payload: ScheduleCreate, actor: UserContext) -> None:
    if payload.source_type == "standard":
        try:
            get_pack(payload.source_key or "", actor)
        except StandardAnalysisError as exc:
            raise ScheduleError(
                "RPT_SCHEDULE_SOURCE_NOT_FOUND",
                exc.message,
                exc.status,
            ) from exc
        return
    if payload.source_type == "template":
        if not catalog_service.node_exists(payload.source_id):
            raise ReportCatalogError("RPT_CATALOG_NODE_NOT_FOUND", "Catalog node not found", 404)
        return
    if payload.source_type in {"dashboard", "data_screen"}:
        with Session(bind=get_meta_engine()) as db:
            try:
                dash = dash_service.get_dashboard(db, payload.source_id)
                dash_service.assert_dashboard_access(
                    db, actor, payload.source_id, dash.created_by, slug=dash.slug,
                )
            except dash_service.DashboardError as exc:
                raise ScheduleError(
                    "RPT_SCHEDULE_SOURCE_NOT_FOUND",
                    exc.message,
                    exc.status,
                ) from exc
        return
    raise ScheduleError("RPT_SCHEDULE_INVALID_SOURCE", "Invalid sourceType", 422)


def _assert_standard_pdf_only(source_type: str, formats: list[str]) -> None:
    if source_type != "standard":
        return
    unsupported = [fmt for fmt in formats if fmt != "pdf"]
    if unsupported:
        raise ScheduleError(
            "RPT_SCHEDULE_FORMAT_UNSUPPORTED",
            "标准分析定时投递当前仅支持 PDF 附件",
            422,
        )


def _validate_attachment_formats(payload: ScheduleCreate) -> None:
    _assert_standard_pdf_only(payload.source_type, list(payload.attachment_formats))


def create_schedule(payload: ScheduleCreate, actor: UserContext) -> ScheduleStatusOut:
    _assert_source_exists(payload, actor)
    _validate_attachment_formats(payload)
    _validate_cron(payload.cron)
    recipients = [r.model_dump(by_alias=True) for r in payload.recipients]
    if payload.source_type == "template" and payload.catalog_node_id:
        register_node_owner(payload.catalog_node_id, actor.id)
    schedule_id = uuid.uuid4()
    row = {
        "id": schedule_id,
        "name": payload.name,
        "catalog_node_id": payload.catalog_node_id,
        "source_type": payload.source_type,
        "source_id": payload.source_id,
        "source_key": payload.source_key,
        "recipients": recipients,
        "attachment_formats": list(payload.attachment_formats),
        "delivery_channels": ["email"],
        "email_smtp_slot": normalize_email_slot(payload.email_smtp_slot),
        "cron": payload.cron,
        "timezone": payload.timezone,
        "status": "draft",
        "owner_id": actor.id,
    }
    _store().save(row)
    return _out(row)


def update_schedule(
    schedule_id: uuid.UUID,
    payload: ScheduleUpdate,
    actor: UserContext,
) -> ScheduleStatusOut:
    row = _get_row(schedule_id)
    schedule_acl.assert_schedule_write(actor, row, "update")
    if row["status"] != "draft":
        raise ScheduleError("RPT_SCHEDULE_NOT_EDITABLE", "Only draft schedules can be edited", 400)
    if payload.cron is not None:
        _validate_cron(payload.cron)
        row["cron"] = payload.cron
    if payload.timezone is not None:
        row["timezone"] = payload.timezone
    if payload.recipients is not None:
        row["recipients"] = [r.model_dump(by_alias=True) for r in payload.recipients]
    if payload.attachment_formats is not None:
        _assert_standard_pdf_only(row["source_type"], list(payload.attachment_formats))
        row["attachment_formats"] = list(payload.attachment_formats)
    if payload.delivery_channels is not None:
        row["delivery_channels"] = ["email"]
    if payload.email_smtp_slot is not None:
        row["email_smtp_slot"] = normalize_email_slot(payload.email_smtp_slot)
    if payload.name is not None:
        row["name"] = payload.name
    _store().save(row)
    return _out(row)


def get_schedule(schedule_id: uuid.UUID, actor: UserContext) -> ScheduleStatusOut:
    row = _get_row(schedule_id)
    schedule_acl.assert_schedule_read(actor, row)
    return _out(row)


def iter_scheduled_rows() -> list[dict]:
    return [row for row in _store().list_all() if row["status"] == "scheduled"]


def list_schedules(
    actor: UserContext,
    *,
    catalog_node_id: uuid.UUID | None = None,
    source_id: uuid.UUID | None = None,
    source_type: str | None = None,
    source_key: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> ScheduleListOut:
    rows = _store().list_all()
    if catalog_node_id is not None:
        rows = [
            r for r in rows
            if r.get("catalog_node_id") == catalog_node_id or r.get("source_id") == catalog_node_id
        ]
    if source_id is not None:
        rows = [r for r in rows if r.get("source_id") == source_id]
    if source_type is not None:
        rows = [r for r in rows if r.get("source_type", "template") == source_type]
    if source_key is not None:
        rows = [r for r in rows if r.get("source_key") == source_key]
    visible: list[dict] = []
    for row in rows:
        try:
            schedule_acl.assert_schedule_read(actor, row)
            visible.append(row)
        except ScheduleError:
            continue
    total = len(visible)
    page = visible[offset : offset + limit]
    return ScheduleListOut(items=[_out(r) for r in page], total=total)


def transition_schedule(schedule_id: uuid.UUID, action: str, actor: UserContext) -> ScheduleStatusOut:
    row = _get_row(schedule_id)
    schedule_acl.assert_schedule_write(actor, row, action)
    status = row["status"]
    mapping = _TRANSITIONS.get(status, {})
    if action not in mapping:
        raise ScheduleError("RPT_SCHEDULE_INVALID_TRANSITION", f"Cannot {action} from {status}", 400)
    if action == "schedule":
        if not row.get("recipients"):
            row["recipients"] = [{"type": "role", "value": "admin"}]
        validate_recipients_present(row["recipients"])
    row["status"] = mapping[action]
    _store().save(row)
    if row["status"] == "scheduled":
        schedule_jobs.register_job_on_transition(schedule_id, row)
    if action == "cancel":
        schedule_jobs.remove_job_on_cancel(schedule_id)
    return _out(row)


def delete_schedule(schedule_id: uuid.UUID, actor: UserContext) -> None:
    row = _get_row(schedule_id)
    schedule_acl.assert_schedule_write(actor, row, "delete")
    schedule_jobs.remove_job_on_cancel(schedule_id)
    if not _store().delete(schedule_id):
        raise ScheduleError("RPT_SCHEDULE_NOT_FOUND", "Schedule not found", 404)
