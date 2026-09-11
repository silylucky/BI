"""Export job + token persistence (memory or DB per rpt_schedule_store)."""

from __future__ import annotations

import secrets
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.datasources.models import get_meta_engine
from app.reports.artifact_store import artifact_storage_key, get_artifact_store
from app.reports.models import DashboardExportJob, ExportToken

EXPORT_TOKEN_TTL_SECONDS = 300

_memory_jobs: dict[uuid.UUID, "ExportJobMeta"] = {}
_memory_tokens: dict[str, tuple[uuid.UUID, datetime]] = {}


@dataclass
class ExportJobMeta:
    job_id: uuid.UUID
    dashboard_id: uuid.UUID
    owner_id: str
    fmt: str
    status: str
    artifact_kind: str | None
    storage_key: str
    created_at: datetime


def _use_db(settings: Settings | None = None) -> bool:
    return (settings or get_settings()).rpt_schedule_store == "db"


def _content_type(fmt: str) -> str:
    return "application/pdf" if fmt == "pdf" else "application/vnd.ms-excel"


def save_export_job(
    *,
    job_id: uuid.UUID,
    dashboard_id: uuid.UUID,
    owner_id: str,
    fmt: str,
    artifact_kind: str | None,
    data: bytes,
) -> ExportJobMeta:
    ext = "pdf" if fmt == "pdf" else "csv"
    key = artifact_storage_key("dashboard-export", job_id, ext)
    get_artifact_store().put(key, data, _content_type(fmt))
    meta = ExportJobMeta(
        job_id=job_id,
        dashboard_id=dashboard_id,
        owner_id=owner_id,
        fmt=fmt,
        status="ready",
        artifact_kind=artifact_kind,
        storage_key=key,
        created_at=datetime.now(UTC),
    )
    if _use_db():
        with Session(bind=get_meta_engine()) as db:
            db.add(DashboardExportJob(
                id=job_id,
                dashboard_id=dashboard_id,
                owner_id=owner_id,
                fmt=fmt,
                status="ready",
                artifact_kind=artifact_kind,
                storage_key=key,
            ))
            db.commit()
    else:
        _memory_jobs[job_id] = meta
    return meta


def get_export_job_meta(job_id: uuid.UUID) -> ExportJobMeta | None:
    if _use_db():
        with Session(bind=get_meta_engine()) as db:
            model = db.get(DashboardExportJob, job_id)
            if model is None:
                return None
            return ExportJobMeta(
                job_id=model.id,
                dashboard_id=model.dashboard_id,
                owner_id=model.owner_id,
                fmt=model.fmt,
                status=model.status,
                artifact_kind=model.artifact_kind,
                storage_key=model.storage_key or "",
                created_at=model.created_at,
            )
    return _memory_jobs.get(job_id)


def read_export_job_bytes(job_id: uuid.UUID) -> bytes | None:
    meta = get_export_job_meta(job_id)
    if meta is None or meta.status != "ready" or not meta.storage_key:
        return None
    return get_artifact_store().get(meta.storage_key)


def issue_export_token(dashboard_id: uuid.UUID) -> str:
    _purge_expired_tokens()
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(UTC) + timedelta(seconds=EXPORT_TOKEN_TTL_SECONDS)
    if _use_db():
        with Session(bind=get_meta_engine()) as db:
            db.add(ExportToken(token=token, dashboard_id=dashboard_id, expires_at=expires_at))
            db.commit()
    else:
        _memory_tokens[token] = (dashboard_id, expires_at)
    return token


def validate_export_token(token: str, dashboard_id: uuid.UUID) -> str | None:
    _purge_expired_tokens()
    if _use_db():
        with Session(bind=get_meta_engine()) as db:
            model = db.get(ExportToken, token)
            if model is None:
                return "DASH_EXPORT_TOKEN_INVALID"
            if model.dashboard_id != dashboard_id:
                return "DASH_EXPORT_TOKEN_MISMATCH"
            if model.expires_at < datetime.now(UTC):
                db.delete(model)
                db.commit()
                return "DASH_EXPORT_TOKEN_EXPIRED"
            return None
    record = _memory_tokens.get(token)
    if record is None:
        return "DASH_EXPORT_TOKEN_INVALID"
    did, expires_at = record
    if did != dashboard_id:
        return "DASH_EXPORT_TOKEN_MISMATCH"
    if expires_at < datetime.now(UTC):
        _memory_tokens.pop(token, None)
        return "DASH_EXPORT_TOKEN_EXPIRED"
    return None


def _purge_expired_tokens() -> None:
    now = datetime.now(UTC)
    if _use_db():
        with Session(bind=get_meta_engine()) as db:
            db.query(ExportToken).filter(ExportToken.expires_at < now).delete()
            db.commit()
    else:
        expired = [key for key, (_, exp) in _memory_tokens.items() if exp < now]
        for key in expired:
            _memory_tokens.pop(key, None)


def reset_export_persistence_for_tests() -> None:
    _memory_jobs.clear()
    _memory_tokens.clear()
    from app.reports.artifact_store import reset_artifact_store_for_tests

    reset_artifact_store_for_tests()
    try:
        with Session(bind=get_meta_engine()) as db:
            db.query(DashboardExportJob).delete()
            db.query(ExportToken).delete()
            db.commit()
    except Exception:
        pass
