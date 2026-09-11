from __future__ import annotations

import logging
import time
import uuid
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.auth.models import get_meta_session
from app.dashboard import export_jobs as dashboard_export_jobs
from app.dashboard import service as dash_service
from app.datasources.models import get_meta_engine
from app.reports.artifact_store import artifact_storage_key, get_artifact_store
from app.reports.catalog.acl import register_artifact_owner
from app.reports.scheduler import acl as schedule_acl
from app.reports.scheduler.delivery import dispatch_artifact
from app.reports.scheduler.errors import ScheduleError
from app.reports.scheduler.recipients import resolve_recipient_emails
from app.reports.scheduler.schemas import ScheduleExecuteOut, ScheduleRecipientIn
from app.reports.scheduler import service as scheduler_service
from app.core.config import get_settings
from app.reports.scheduler.store import MemoryScheduleStore, get_schedule_store
from app.reports.scheduler.status_public import normalize_execute_out, to_public_execution_status
from app.reports.scheduler.user_errors import user_visible_export_error

logger = logging.getLogger(__name__)

_EXECUTE_BUDGET_MS = 20
_SEMI_BUDGET_MS = 35

# Backward compat for tests that clear these directly
_EXECUTION_LOG: dict[str, ScheduleExecuteOut] = {}
_EXECUTION_BY_ID: dict[uuid.UUID, ScheduleExecuteOut] = {}
_HISTORY: dict[uuid.UUID, list[dict]] = {}


def _memory_store() -> MemoryScheduleStore | None:
    store = get_schedule_store()
    return store if isinstance(store, MemoryScheduleStore) else None


def _execution_row_to_out(row: dict) -> ScheduleExecuteOut:
    return normalize_execute_out(
        ScheduleExecuteOut(
            executionId=row["executionId"],
            scheduleId=row["scheduleId"],
            status=row["status"],
            artifactRef=row["artifactRef"],
            artifactKind=row.get("artifactKind"),
            idempotencyKey=row.get("idempotencyKey") or "",
            executedAt=row.get("executedAt") or datetime.now(UTC).isoformat(),
            deliverySteps=row.get("deliverySteps") or [],
            revisionSnapshot=row.get("revisionSnapshot"),
            errorMessage=row.get("errorMessage"),
            parentExecutionId=row.get("parentExecutionId"),
            secondaryArtifacts=row.get("secondaryArtifacts") or [],
        ),
    )


def _get_cached_execution(idempotency_key: str) -> ScheduleExecuteOut | None:
    mem = _memory_store()
    if mem is not None:
        row = mem.get_idempotency(idempotency_key)
        return _execution_row_to_out(row) if row else None
    row = get_schedule_store().get_idempotency(idempotency_key)
    if row is not None:
        return _execution_row_to_out(row)
    return _EXECUTION_LOG.get(idempotency_key)


def _remember_execution(out: ScheduleExecuteOut) -> None:
    payload = out.model_dump(by_alias=True)
    mem = _memory_store()
    if mem is not None:
        mem.cache_idempotency(out.idempotency_key, payload)
    else:
        get_schedule_store().cache_idempotency(out.idempotency_key, payload)
    if get_settings().rpt_schedule_store == "memory":
        _EXECUTION_LOG[out.idempotency_key] = out
        _EXECUTION_BY_ID[out.execution_id] = out


def _get_execution_out(execution_id: uuid.UUID) -> ScheduleExecuteOut | None:
    mem = _memory_store()
    if mem is not None:
        cached = _EXECUTION_BY_ID.get(execution_id)
        if cached is not None:
            return cached
        row = mem.get_execution(execution_id)
        return _execution_row_to_out(row) if row else None
    row = get_schedule_store().get_execution(execution_id)
    if row is not None:
        return _execution_row_to_out(row)
    return _EXECUTION_BY_ID.get(execution_id)


def _append_history(
    schedule_id: uuid.UUID,
    out: ScheduleExecuteOut,
    *,
    error_message: str | None = None,
) -> None:
    entry = {
        "executionId": out.execution_id,
        "scheduleId": out.schedule_id,
        "status": out.status,
        "artifactRef": out.artifact_ref,
        "artifactKind": out.artifact_kind,
        "secondaryArtifacts": out.secondary_artifacts,
        "artifactStorageKey": (
            out.artifact_ref.removeprefix("storage://")
            if out.artifact_ref.startswith("storage://")
            else None
        ),
        "executedAt": out.executed_at,
        "errorMessage": error_message or out.error_message,
        "parentExecutionId": out.parent_execution_id,
    }
    mem = _memory_store()
    if mem is not None:
        mem.append_execution(schedule_id, entry)
    else:
        store = get_schedule_store()
        store.append_execution(schedule_id, entry, out.model_dump(by_alias=True))
    _HISTORY.setdefault(schedule_id, []).append(entry)


def _is_failure_status(status: str) -> bool:
    return "failed" in status or "degraded" in status


def _is_success_status(status: str) -> bool:
    if _is_failure_status(status):
        return False
    return "succeeded" in status or status == "mock_succeeded"


def list_recent_failed_executions(limit: int = 20) -> dict:
    mem = _memory_store()
    rows: list[dict] = mem.list_all_executions() if mem else get_schedule_store().list_all_executions()
    latest_success_by_schedule: dict[str, str] = {}
    for entry in rows:
        schedule_id = str(entry.get("scheduleId", ""))
        status = entry.get("status", "")
        if not schedule_id or not _is_success_status(status):
            continue
        executed_at = entry.get("executedAt") or ""
        prev = latest_success_by_schedule.get(schedule_id)
        if prev is None or executed_at > prev:
            latest_success_by_schedule[schedule_id] = executed_at

    failed_rows: list[dict] = []
    for entry in rows:
        status = entry.get("status", "")
        if not _is_failure_status(status):
            continue
        schedule_id = str(entry.get("scheduleId", ""))
        fail_at = entry.get("executedAt") or ""
        success_at = latest_success_by_schedule.get(schedule_id)
        if success_at and success_at >= fail_at:
            continue
        failed_rows.append(entry)
    failed_rows.sort(key=lambda r: r.get("executedAt", ""), reverse=True)
    return {
        "items": [_public_history_row(row) for row in failed_rows[:limit]],
        "total": len(failed_rows),
    }


def list_executions(schedule_id: uuid.UUID, limit: int = 50, offset: int = 0) -> dict:
    mem = _memory_store()
    if mem is not None:
        rows = sorted(mem.list_executions(schedule_id), key=lambda r: r["executedAt"], reverse=True)
    else:
        rows = get_schedule_store().list_executions(schedule_id)
    page = [_public_history_row(row) for row in rows[offset : offset + limit]]
    return {"items": page, "total": len(rows)}


def _public_history_row(row: dict) -> dict:
    item = dict(row)
    item["status"] = to_public_execution_status(str(item.get("status") or ""))
    return item


def mock_execute_schedule(
    schedule_id: uuid.UUID,
    idempotency_key: str,
    actor: UserContext,
) -> ScheduleExecuteOut:
    del actor
    if not idempotency_key:
        raise ScheduleError("RPT_SCHEDULE_EXECUTE_INVALID", "Idempotency-Key required", 422)
    cached = _get_cached_execution(idempotency_key)
    if cached is not None:
        return cached
    row = scheduler_service._get_row(schedule_id)
    if row["status"] != "scheduled":
        raise ScheduleError("RPT_SCHEDULE_EXECUTE_NOT_READY", f"Cannot execute from {row['status']}", 400)
    execution_id = uuid.uuid4()
    out = ScheduleExecuteOut(
        executionId=execution_id,
        scheduleId=schedule_id,
        status="mock_succeeded",
        artifactRef=f"test://reports/{schedule_id}/{execution_id}",
        idempotencyKey=idempotency_key,
        executedAt=datetime.now(UTC).isoformat(),
    )
    _remember_execution(out)
    _append_history(schedule_id, out)
    return normalize_execute_out(out)


def _persist_execution_artifact(
    execution_id: uuid.UUID,
    attachments: list[tuple[bytes, str, str]],
    *,
    artifact_kind: str | None,
) -> tuple[str, str | None, list[dict]]:
    if not attachments:
        return f"semi://reports/{execution_id}", None, []
    primary_ref = ""
    primary_key: str | None = None
    secondary: list[dict] = []
    for index, (data, mime, filename) in enumerate(attachments):
        ext = filename.rsplit(".", 1)[-1] if "." in filename else "bin"
        storage_key = artifact_storage_key("schedule-execution", execution_id, ext)
        get_artifact_store().put(storage_key, data, mime)
        if index == 0:
            primary_ref = f"storage://{storage_key}"
            primary_key = storage_key
            continue
        label = "按组件分页" if "按组件分页" in filename else filename
        kind = "visual_snapshot_per_widget" if "按组件分页" in filename else "secondary"
        secondary.append({
            "label": label,
            "kind": kind,
            "storageKey": storage_key,
            "filename": filename,
        })
    return primary_ref, primary_key, secondary


def _record_delivery_attempts(execution_id: uuid.UUID, steps: list[dict]) -> None:
    try:
        from sqlalchemy.orm import Session

        from app.datasources.models import get_meta_engine
        from app.reports.models import ReportDeliveryAttempt

        with Session(bind=get_meta_engine()) as db:
            for step in steps:
                db.add(ReportDeliveryAttempt(
                    execution_id=execution_id,
                    channel=step.get("channel", "unknown"),
                    status=step.get("status", "unknown"),
                    response_summary=step.get("response"),
                    error_message=step.get("error"),
                ))
            db.commit()
    except Exception:
        logger.warning("report_delivery_attempt_persist_failed", exc_info=True)


def _export_template_attachments(
    source_id: uuid.UUID,
    formats: list[str],
    actor: UserContext,
) -> tuple[str, str | None, list[tuple[bytes, str, str]], str | None]:
    from app.reports.engine.service import export_template_bytes
    from app.reports.render.render_from_spec import content_type_for

    attachments: list[tuple[bytes, str, str]] = []
    artifact_ref = f"semi://reports/template/{source_id}"
    export_error: str | None = None
    for fmt in formats:
        try:
            data = export_template_bytes(source_id, fmt, actor)
            mime = content_type_for(fmt)
            ext = "xlsx" if fmt == "excel" else fmt
            attachments.append((data, mime, f"report-{source_id}.{ext}"))
        except Exception as exc:
            export_error = user_visible_export_error(exc)
            break
    kind = "template_render" if attachments else None
    return artifact_ref, kind, attachments, export_error


def _export_dashboard_attachments(
    source_id: uuid.UUID,
    formats: list[str],
    actor: UserContext,
) -> tuple[str, str | None, list[tuple[bytes, str, str]], str | None]:
    attachments: list[tuple[bytes, str, str]] = []
    artifact_kind: str | None = None
    artifact_ref = ""
    export_error: str | None = None
    for fmt in formats:
        try:
            with Session(bind=get_meta_engine()) as db:
                if fmt == "pdf":
                    batch = dashboard_export_jobs.build_dashboard_schedule_pdf_attachments(
                        db, source_id, actor,
                    )
                    attachments.extend(batch)
                    if not artifact_ref and batch:
                        artifact_kind = "visual_snapshot_full_page"
                        artifact_ref = f"dashboard://{source_id}/pdf-full"
                else:
                    job = dashboard_export_jobs.submit_dashboard_export(db, source_id, fmt, actor)
                    if not artifact_ref:
                        artifact_ref = job.download_url or ""
                        artifact_kind = job.artifact_kind
                    job_id = dashboard_export_jobs.parse_export_job_id_from_download_url(job.download_url)
                    if job_id is not None:
                        attachment = dashboard_export_jobs.read_export_attachment(job_id)
                        if attachment is not None:
                            attachments.append(attachment)
        except dash_service.DashboardError as exc:
            export_error = exc.message
            break
    return artifact_ref, artifact_kind, attachments, export_error


def semi_real_execute_schedule(
    schedule_id: uuid.UUID,
    idempotency_key: str,
    actor: UserContext,
    delivery_mock: str | None = None,
) -> ScheduleExecuteOut:
    if not idempotency_key:
        raise ScheduleError("RPT_SCHEDULE_EXECUTE_INVALID", "Idempotency-Key required", 422)
    cached = _get_cached_execution(idempotency_key)
    if cached is not None:
        return cached
    row = scheduler_service._get_row(schedule_id)
    if row["status"] != "scheduled":
        raise ScheduleError("RPT_SCHEDULE_EXECUTE_NOT_READY", f"Cannot execute from {row['status']}", 400)
    execution_id = uuid.uuid4()
    source_type = row.get("source_type", "template")
    source_id = row.get("source_id") or row["catalog_node_id"]
    revision_snapshot = None
    if source_type == "template" and source_id is not None:
        from app.reports.extension import service as extension_service
        try:
            ext = extension_service.get_extension(source_id)
            revision_snapshot = {"revision": ext.revision, "metricCount": len(ext.metrics)}
        except Exception:
            pass
    artifact_ref = f"semi://reports/{schedule_id}/{execution_id}"
    artifact_kind = "template_render"
    export_error: str | None = None
    attachments: list[tuple[bytes, str, str]] = []
    if source_type in {"dashboard", "data_screen"} and source_id is not None:
        formats = row.get("attachment_formats") or ["pdf"]
        artifact_ref, artifact_kind, attachments, export_error = _export_dashboard_attachments(
            source_id, formats, actor,
        )
    elif source_type == "template" and source_id is not None:
        formats = row.get("attachment_formats") or ["pdf"]
        artifact_ref, artifact_kind, attachments, export_error = _export_template_attachments(
            source_id, formats, actor,
        )
    elif source_type == "standard":
        pack_key = row.get("source_key")
        if not pack_key:
            export_error = "标准分析调度缺少 sourceKey"
        else:
            from app.reports.scheduler.standard_export import export_standard_attachments

            formats = row.get("attachment_formats") or ["pdf"]
            artifact_ref, artifact_kind, attachments, export_error = export_standard_attachments(
                pack_key, formats, actor,
            )
    if not export_error and attachments:
        artifact_ref, _storage_key, secondary_artifacts = _persist_execution_artifact(
            execution_id, attachments, artifact_kind=artifact_kind,
        )
    else:
        secondary_artifacts = []
    if export_error:
        out = ScheduleExecuteOut(
            executionId=execution_id,
            scheduleId=schedule_id,
            status="semi_real_failed",
            artifactRef=artifact_ref or f"semi://reports/{schedule_id}/{execution_id}",
            artifactKind=None,
            idempotencyKey=idempotency_key,
            executedAt=datetime.now(UTC).isoformat(),
            deliverySteps=[],
            revisionSnapshot=revision_snapshot,
            errorMessage=export_error,
        )
        _remember_execution(out)
        _append_history(schedule_id, out, error_message=export_error)
        return normalize_execute_out(out)
    recipient_emails: list[str] | None = None
    raw_recipients = row.get("recipients") or []
    channels = ["email"]
    if raw_recipients:
        session = get_meta_session()
        try:
            parsed = [ScheduleRecipientIn.model_validate(r) for r in raw_recipients]
            recipient_emails = resolve_recipient_emails(session, parsed)
        finally:
            session.close()
    if not recipient_emails:
        error_message = (
            "未解析到有效收件邮箱：请配置接收人（直接填邮箱，或确保角色/用户资料含真实邮箱）。"
        )
        out = ScheduleExecuteOut(
            executionId=execution_id,
            scheduleId=schedule_id,
            status="semi_real_failed",
            artifactRef=artifact_ref or f"semi://reports/{schedule_id}/{execution_id}",
            artifactKind=artifact_kind,
            idempotencyKey=idempotency_key,
            executedAt=datetime.now(UTC).isoformat(),
            deliverySteps=[{
                "channel": "email",
                "status": "failed",
                "attempt": 1,
                "mode": "smtp",
                "error": error_message,
                "recipients": [],
            }],
            revisionSnapshot=revision_snapshot,
            errorMessage=error_message,
        )
        _remember_execution(out)
        _append_history(schedule_id, out, error_message=error_message)
        return normalize_execute_out(out)
    att_bytes = attachments[0][0] if attachments else None
    att_mime = attachments[0][1] if attachments else None
    att_name = attachments[0][2] if attachments else None
    owner_id = row.get("owner_id")
    delivery_session = get_meta_session()
    try:
        delivery = dispatch_artifact(
            artifact_ref,
            channels,
            delivery_mock,
            session=delivery_session,
            recipient_emails=recipient_emails,
            artifact_kind=artifact_kind,
            attachment_bytes=att_bytes,
            attachment_filename=att_name,
            attachment_mime=att_mime,
            attachments=attachments,
            email_smtp_slot=row.get("email_smtp_slot") or "qq",
            owner_id=owner_id,
        )
        delivery_session.commit()
    finally:
        delivery_session.close()
    error_message: str | None = None
    if delivery_mock == "fail":
        status = "semi_real_failed"
        error_message = "delivery failed"
    elif delivery["status"] == "delivered":
        status = "semi_real_succeeded"
    elif delivery["status"] == "unconfigured":
        status = "semi_real_failed"
        error_message = delivery.get("error") or "SMTP delivery not configured"
    else:
        status = "semi_real_delivery_degraded"
        error_message = delivery.get("error") or next(
            (step.get("error") for step in delivery.get("deliverySteps", []) if step.get("error")),
            None,
        )
    out = ScheduleExecuteOut(
        executionId=execution_id,
        scheduleId=schedule_id,
        status=status,
        artifactRef=artifact_ref,
        artifactKind=artifact_kind,
        secondaryArtifacts=secondary_artifacts,
        idempotencyKey=idempotency_key,
        executedAt=datetime.now(UTC).isoformat(),
        deliverySteps=delivery["deliverySteps"],
        revisionSnapshot=revision_snapshot,
        errorMessage=error_message,
    )
    _remember_execution(out)
    _append_history(schedule_id, out, error_message=error_message)
    _record_delivery_attempts(execution_id, delivery["deliverySteps"])
    register_artifact_owner(artifact_ref, actor.id)
    return normalize_execute_out(out)


def retry_execution(
    execution_id: uuid.UUID,
    idempotency_key: str,
    actor: UserContext,
) -> ScheduleExecuteOut:
    out = _get_execution_out(execution_id)
    if out is None:
        raise ScheduleError("RPT_SCHEDULE_EXECUTION_NOT_FOUND", "Execution not found", 404)
    if "degraded" not in out.status and "failed" not in out.status:
        raise ScheduleError("RPT_SCHEDULE_RETRY_NOT_ALLOWED", "Only failed/degraded executions can retry", 400)
    schedule_id = out.schedule_id
    schedule_acl.assert_schedule_write(actor, scheduler_service._get_row(schedule_id), "retry")
    new_out = semi_real_execute_schedule(schedule_id, idempotency_key, actor)
    return new_out.model_copy(update={"parent_execution_id": execution_id})


def get_execution_artifact_meta(execution_id: uuid.UUID) -> dict:
    out = _get_execution_out(execution_id)
    if out is None:
        from app.reports.catalog.errors import ReportCatalogError
        raise ReportCatalogError("RPT_ARTIFACT_NOT_FOUND", "Execution artifact not found", 404)
    download_url = None
    if out.artifact_ref.startswith("storage://"):
        download_url = f"/api/v1/reports/schedules/executions/{execution_id}/artifact/download"
    return {
        "executionId": str(out.execution_id),
        "artifactRef": out.artifact_ref,
        "artifactKind": out.artifact_kind,
        "status": out.status,
        "executedAt": out.executed_at,
        "downloadUrl": download_url,
    }


def get_execution_artifact_download(
    execution_id: uuid.UUID,
    *,
    slot: str | None = None,
) -> tuple[bytes, str, str]:
    out = _get_execution_out(execution_id)
    if out is None or not out.artifact_ref.startswith("storage://"):
        from app.reports.catalog.errors import ReportCatalogError
        raise ReportCatalogError("RPT_ARTIFACT_NOT_FOUND", "Execution artifact not found", 404)
    storage_key = out.artifact_ref.removeprefix("storage://")
    filename = f"schedule-{execution_id}-可视化报告.pdf"
    if slot in {"per_widget", "1", "secondary"}:
        secondary = out.secondary_artifacts or []
        if not secondary:
            from app.reports.catalog.errors import ReportCatalogError
            raise ReportCatalogError("RPT_ARTIFACT_NOT_FOUND", "Secondary artifact not found", 404)
        item = secondary[0]
        storage_key = item.get("storageKey") or ""
        filename = item.get("filename") or f"schedule-{execution_id}-按组件分页.pdf"
    data = get_artifact_store().get(storage_key)
    if data is None:
        from app.reports.catalog.errors import ReportCatalogError
        raise ReportCatalogError("RPT_ARTIFACT_NOT_FOUND", "Execution artifact not found", 404)
    ext = storage_key.rsplit(".", 1)[-1]
    mime = "application/pdf" if ext == "pdf" else "application/octet-stream"
    return data, mime, filename


def probe_mock_execute_budget_ms(schedule_id: uuid.UUID, key: str, actor: UserContext) -> float:
    start = time.perf_counter()
    mock_execute_schedule(schedule_id, key, actor)
    return (time.perf_counter() - start) * 1000.0


def probe_semi_real_execute_budget_ms(schedule_id: uuid.UUID, key: str, actor: UserContext) -> float:
    start = time.perf_counter()
    semi_real_execute_schedule(schedule_id, key, actor)
    return (time.perf_counter() - start) * 1000.0
