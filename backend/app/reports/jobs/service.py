"""Report job submission and polling."""

from __future__ import annotations

import uuid

from app.auth.deps import UserContext
from app.reports.contract import ReportJobKind, ReportJobStatus
from app.reports.errors import ReportBatchError
from app.reports.jobs import store as job_store
from app.reports.jobs.worker import process_one_job


def submit_batch_export_job(
    *,
    owner_id: str,
    node_ids: list[uuid.UUID],
    fmt: str,
) -> dict:
    job = job_store.create_job(
        job_kind=ReportJobKind.BATCH_EXPORT.value,
        owner_id=owner_id,
        payload={"nodeIds": [str(nid) for nid in node_ids], "format": fmt},
    )
    process_one_job(UserContext(id=owner_id, username=owner_id, roles=["admin"]))
    job = job_store.get_job(job["id"])
    assert job is not None
    return {
        "jobId": job["id"],
        "status": job["status"],
        "downloadUrl": None,
    }


def get_job_status(job_id: uuid.UUID, actor: UserContext) -> dict:
    job = job_store.get_job(job_id)
    if job is None:
        raise ReportBatchError("RPT_BATCH_EXPORT_JOB_NOT_FOUND", "Export job not found", 404)
    if job["ownerId"] != actor.id and "admin" not in actor.roles:
        raise ReportBatchError("RPT_BATCH_EXPORT_JOB_FORBIDDEN", "Export job access denied", 403)
    job_store.increment_poll(job_id)
    process_one_job(actor)
    job = job_store.get_job(job_id)
    assert job is not None
    download_url = (
        f"/api/v1/reports/jobs/{job_id}/download"
        if job["status"] == ReportJobStatus.READY.value
        else None
    )
    return {
        "jobId": job["id"],
        "status": job["status"],
        "downloadUrl": download_url,
        "errorMessage": job.get("errorMessage"),
    }


def read_job_download(job_id: uuid.UUID, actor: UserContext) -> tuple[bytes, str, str]:
    job = job_store.get_job(job_id)
    if job is None or job["status"] != ReportJobStatus.READY.value:
        raise ReportBatchError("RPT_BATCH_EXPORT_JOB_NOT_FOUND", "Export job not ready", 404)
    if job["ownerId"] != actor.id and "admin" not in actor.roles:
        raise ReportBatchError("RPT_BATCH_EXPORT_JOB_FORBIDDEN", "Export job access denied", 403)
    storage_key = job.get("resultStorageKey")
    if not storage_key:
        raise ReportBatchError("RPT_BATCH_EXPORT_JOB_NOT_FOUND", "Export artifact missing", 404)
    data = get_artifact_store().get(storage_key)
    if data is None:
        raise ReportBatchError("RPT_BATCH_EXPORT_JOB_NOT_FOUND", "Export artifact missing", 404)
    content_type = job.get("contentType") or "application/zip"
    return data, content_type, f"batch-export-{job_id}.zip"


from app.reports.artifact_store import get_artifact_store  # noqa: E402
