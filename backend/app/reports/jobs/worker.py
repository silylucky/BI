"""Lease worker: claim pending report jobs and execute them."""

from __future__ import annotations

import io
import uuid
import zipfile

from app.auth.deps import UserContext
from app.reports.artifact_store import artifact_storage_key, get_artifact_store
from app.reports.contract import ReportJobKind
from app.reports.jobs import store as job_store
from app.reports.render.render_from_spec import content_type_for


def _worker_id() -> str:
    return f"report-worker-{uuid.uuid4().hex[:8]}"


def _execute_batch_export(job: dict, actor: UserContext) -> tuple[bytes, str]:
    from app.reports.catalog import service as catalog_service
    from app.reports.engine import execute as engine_execute
    from app.reports.engine.service import export_template_bytes
    from app.reports.render.render_from_spec import render_document

    payload = job.get("payload") or {}
    node_ids = [uuid.UUID(str(nid)) for nid in payload.get("nodeIds", [])]
    fmt = payload.get("format", "pdf")
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for node_id in node_ids:
            try:
                data = export_template_bytes(node_id, fmt, actor)
            except Exception:
                node = catalog_service.get_node(node_id)
                sections = (
                    engine_execute.build_sections_from_template_blocks(node.template_key or "")
                    if node.template_key
                    else [{"kind": "table", "placeholder": True}]
                )
                data = render_document(
                    {"sections": sections, "format": fmt, "engineVersion": "1.0"},
                    fmt,
                    title=node.name,
                )
            ext = "xlsx" if fmt == "excel" else fmt
            archive.writestr(f"report-{node_id}.{ext}", data)
    return buffer.getvalue(), "application/zip"


def process_one_job(actor: UserContext | None = None) -> dict | None:
    job_store.release_expired_leases()
    worker = _worker_id()
    job = job_store.claim_next_job(worker)
    if job is None:
        return None
    job_id = job["id"]
    owner = actor or UserContext(id=job["ownerId"], username=job["ownerId"], roles=["admin"])
    try:
        if job["jobKind"] == ReportJobKind.BATCH_EXPORT.value:
            data, content_type = _execute_batch_export(job, owner)
            storage_key = artifact_storage_key("batch-export", job_id, "zip")
            get_artifact_store().put(storage_key, data, content_type)
            return job_store.complete_job(job_id, storage_key=storage_key, content_type=content_type)
        raise ValueError(f"unsupported job kind: {job['jobKind']}")
    except Exception as exc:
        return job_store.fail_job(job_id, str(exc))


def process_pending_jobs(limit: int = 5, actor: UserContext | None = None) -> list[dict]:
    processed: list[dict] = []
    for _ in range(limit):
        result = process_one_job(actor)
        if result is None:
            break
        processed.append(result)
    return processed
