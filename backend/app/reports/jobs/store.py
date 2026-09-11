"""Report job queue persistence and lease claims."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.datasources.models import get_meta_engine
from app.reports.contract import ReportJobStatus
from app.reports.models import ReportJob

_LEASE_SECONDS = 120
_MEMORY_JOBS: dict[uuid.UUID, dict] = {}


def _row_to_dict(job: ReportJob) -> dict:
    return {
        "id": job.id,
        "jobKind": job.job_kind,
        "ownerId": job.owner_id,
        "status": job.status,
        "payload": job.payload or {},
        "resultStorageKey": job.result_storage_key,
        "contentType": job.content_type,
        "errorMessage": job.error_message,
        "pollCount": job.poll_count,
        "createdAt": job.created_at.isoformat() if job.created_at else "",
        "updatedAt": job.updated_at.isoformat() if job.updated_at else "",
    }


def create_job(
    *,
    job_kind: str,
    owner_id: str,
    payload: dict,
    job_id: uuid.UUID | None = None,
) -> dict:
    job_id = job_id or uuid.uuid4()
    row = {
        "id": job_id,
        "job_kind": job_kind,
        "owner_id": owner_id,
        "status": ReportJobStatus.PENDING.value,
        "payload": payload,
        "result_storage_key": None,
        "content_type": None,
        "error_message": None,
        "lease_owner": None,
        "lease_expires_at": None,
        "poll_count": 0,
    }
    try:
        with Session(bind=get_meta_engine()) as db:
            db.add(ReportJob(**row))
            db.commit()
            saved = db.get(ReportJob, job_id)
            return _row_to_dict(saved) if saved else row
    except Exception:
        _MEMORY_JOBS[job_id] = row
        return {
            "id": job_id,
            "jobKind": job_kind,
            "ownerId": owner_id,
            "status": ReportJobStatus.PENDING.value,
            "payload": payload,
            "resultStorageKey": None,
            "contentType": None,
            "errorMessage": None,
            "pollCount": 0,
            "createdAt": datetime.now(UTC).isoformat(),
            "updatedAt": datetime.now(UTC).isoformat(),
        }


def get_job(job_id: uuid.UUID) -> dict | None:
    if job_id in _MEMORY_JOBS:
        row = _MEMORY_JOBS[job_id]
        return {
            "id": row["id"],
            "jobKind": row["job_kind"],
            "ownerId": row["owner_id"],
            "status": row["status"],
            "payload": row["payload"],
            "resultStorageKey": row.get("result_storage_key"),
            "contentType": row.get("content_type"),
            "errorMessage": row.get("error_message"),
            "pollCount": row.get("poll_count", 0),
            "createdAt": "",
            "updatedAt": "",
        }
    with Session(bind=get_meta_engine()) as db:
        job = db.get(ReportJob, job_id)
        return _row_to_dict(job) if job else None


def increment_poll(job_id: uuid.UUID) -> dict | None:
    if job_id in _MEMORY_JOBS:
        _MEMORY_JOBS[job_id]["poll_count"] = _MEMORY_JOBS[job_id].get("poll_count", 0) + 1
        return get_job(job_id)
    with Session(bind=get_meta_engine()) as db:
        job = db.get(ReportJob, job_id)
        if job is None:
            return None
        job.poll_count += 1
        db.commit()
        db.refresh(job)
        return _row_to_dict(job)


def claim_next_job(worker_id: str, job_kind: str | None = None) -> dict | None:
    now = datetime.now(UTC)
    lease_until = now + timedelta(seconds=_LEASE_SECONDS)
    try:
        with Session(bind=get_meta_engine()) as db:
            stmt = (
                select(ReportJob)
                .where(ReportJob.status == ReportJobStatus.PENDING.value)
                .order_by(ReportJob.created_at.asc())
                .limit(1)
            )
            if job_kind:
                stmt = stmt.where(ReportJob.job_kind == job_kind)
            job = db.scalar(stmt.with_for_update(skip_locked=True))
            if job is None:
                return _claim_memory_job(worker_id, job_kind)
            job.status = ReportJobStatus.PROCESSING.value
            job.lease_owner = worker_id
            job.lease_expires_at = lease_until
            db.commit()
            db.refresh(job)
            return _row_to_dict(job)
    except Exception:
        return _claim_memory_job(worker_id, job_kind)


def _claim_memory_job(worker_id: str, job_kind: str | None) -> dict | None:
    for job_id, row in sorted(_MEMORY_JOBS.items(), key=lambda item: item[0].hex):
        if row["status"] != ReportJobStatus.PENDING.value:
            continue
        if job_kind and row["job_kind"] != job_kind:
            continue
        row["status"] = ReportJobStatus.PROCESSING.value
        row["lease_owner"] = worker_id
        row["lease_expires_at"] = datetime.now(UTC) + timedelta(seconds=_LEASE_SECONDS)
        return get_job(job_id)
    return None


def complete_job(
    job_id: uuid.UUID,
    *,
    storage_key: str,
    content_type: str,
) -> dict | None:
    if job_id in _MEMORY_JOBS:
        row = _MEMORY_JOBS[job_id]
        row["status"] = ReportJobStatus.READY.value
        row["result_storage_key"] = storage_key
        row["content_type"] = content_type
        return get_job(job_id)
    with Session(bind=get_meta_engine()) as db:
        job = db.get(ReportJob, job_id)
        if job is None:
            return None
        job.status = ReportJobStatus.READY.value
        job.result_storage_key = storage_key
        job.content_type = content_type
        job.lease_owner = None
        job.lease_expires_at = None
        db.commit()
        db.refresh(job)
        return _row_to_dict(job)


def fail_job(job_id: uuid.UUID, error_message: str) -> dict | None:
    if job_id in _MEMORY_JOBS:
        row = _MEMORY_JOBS[job_id]
        row["status"] = ReportJobStatus.FAILED.value
        row["error_message"] = error_message
        return get_job(job_id)
    with Session(bind=get_meta_engine()) as db:
        job = db.get(ReportJob, job_id)
        if job is None:
            return None
        job.status = ReportJobStatus.FAILED.value
        job.error_message = error_message
        job.lease_owner = None
        job.lease_expires_at = None
        db.commit()
        db.refresh(job)
        return _row_to_dict(job)


def release_expired_leases() -> int:
    now = datetime.now(UTC)
    released = 0
    for row in _MEMORY_JOBS.values():
        expires = row.get("lease_expires_at")
        if (
            row.get("status") == ReportJobStatus.PROCESSING.value
            and expires is not None
            and expires < now
        ):
            row["status"] = ReportJobStatus.PENDING.value
            row["lease_owner"] = None
            row["lease_expires_at"] = None
            released += 1
    try:
        with Session(bind=get_meta_engine()) as db:
            result = db.execute(
                update(ReportJob)
                .where(
                    ReportJob.status == ReportJobStatus.PROCESSING.value,
                    ReportJob.lease_expires_at.is_not(None),
                    ReportJob.lease_expires_at < now,
                )
                .values(status=ReportJobStatus.PENDING.value, lease_owner=None, lease_expires_at=None),
            )
            db.commit()
            released += int(result.rowcount or 0)
    except Exception:
        pass
    return released


def reset_jobs_for_tests() -> None:
    _MEMORY_JOBS.clear()
    try:
        with Session(bind=get_meta_engine()) as db:
            db.query(ReportJob).delete()
            db.commit()
    except Exception:
        pass
