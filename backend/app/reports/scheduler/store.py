"""Schedule + execution persistence: memory (tests) or DB (production)."""

from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.datasources.models import get_meta_engine
from app.reports.models import (
    DashboardExportJob,
    ExportToken,
    ReportDeliveryAttempt,
    ReportDismissedFailure,
    ReportSchedule,
    ReportScheduleExecution,
    ScheduleTickLock,
)


def _schedule_to_row(model: ReportSchedule) -> dict:
    return {
        "id": model.id,
        "name": model.name,
        "catalog_node_id": model.catalog_node_id,
        "source_type": model.source_type,
        "source_id": model.source_id,
        "source_key": model.source_key,
        "owner_id": model.owner_id,
        "recipients": model.recipients or [],
        "attachment_formats": model.attachment_formats or ["pdf"],
        "delivery_channels": model.delivery_channels or ["email"],
        "email_smtp_slot": model.email_smtp_slot or "qq",
        "cron": model.cron,
        "timezone": model.timezone,
        "status": model.status,
    }


def _execution_to_dict(m: ReportScheduleExecution) -> dict:
    return {
        "executionId": m.id,
        "scheduleId": m.schedule_id,
        "status": m.status,
        "artifactRef": m.artifact_ref,
        "artifactKind": m.artifact_kind,
        "secondaryArtifacts": m.secondary_artifacts or [],
        "executedAt": m.executed_at.isoformat() if m.executed_at else "",
        "errorMessage": m.error_message,
        "parentExecutionId": m.parent_execution_id,
        "idempotencyKey": m.idempotency_key or "",
        "deliverySteps": m.delivery_steps or [],
        "revisionSnapshot": m.revision_snapshot,
    }


class ScheduleStore(ABC):
    @abstractmethod
    def get(self, schedule_id: uuid.UUID) -> dict | None: ...

    @abstractmethod
    def save(self, row: dict) -> dict: ...

    @abstractmethod
    def list_all(self) -> list[dict]: ...

    @abstractmethod
    def delete(self, schedule_id: uuid.UUID) -> bool: ...

    @abstractmethod
    def clear(self) -> None: ...


class MemoryScheduleStore(ScheduleStore):
    def __init__(self) -> None:
        self._schedules: dict[uuid.UUID, dict] = {}
        self._executions: dict[uuid.UUID, list[dict]] = {}
        self._execution_by_id: dict[uuid.UUID, dict] = {}
        self._idempotency: dict[str, dict] = {}
        self._export_jobs: dict[uuid.UUID, dict] = {}
        self._export_tokens: dict[str, dict] = {}

    def get(self, schedule_id: uuid.UUID) -> dict | None:
        return self._schedules.get(schedule_id)

    def save(self, row: dict) -> dict:
        self._schedules[row["id"]] = dict(row)
        return self._schedules[row["id"]]

    def list_all(self) -> list[dict]:
        return list(self._schedules.values())

    def delete(self, schedule_id: uuid.UUID) -> bool:
        if schedule_id not in self._schedules:
            return False
        self._schedules.pop(schedule_id, None)
        history = self._executions.pop(schedule_id, [])
        for entry in history:
            exec_id = entry.get("executionId")
            if exec_id is not None:
                self._execution_by_id.pop(exec_id, None)
        stale_keys = [
            key
            for key, out in self._idempotency.items()
            if str(out.get("scheduleId")) == str(schedule_id)
        ]
        for key in stale_keys:
            self._idempotency.pop(key, None)
        return True

    def clear(self) -> None:
        self._schedules.clear()
        self._executions.clear()
        self._execution_by_id.clear()
        self._idempotency.clear()
        self._export_jobs.clear()
        self._export_tokens.clear()

    def append_execution(self, schedule_id: uuid.UUID, entry: dict) -> None:
        self._executions.setdefault(schedule_id, []).append(entry)
        self._execution_by_id[entry["executionId"]] = entry

    def list_executions(self, schedule_id: uuid.UUID) -> list[dict]:
        return list(self._executions.get(schedule_id, []))

    def get_execution(self, execution_id: uuid.UUID) -> dict | None:
        return self._execution_by_id.get(execution_id)

    def list_all_executions(self) -> list[dict]:
        rows: list[dict] = []
        for schedule_id, history in self._executions.items():
            for entry in history:
                rows.append({**entry, "scheduleId": schedule_id})
        return rows

    def cache_idempotency(self, key: str, out: dict) -> None:
        self._idempotency[key] = out

    def get_idempotency(self, key: str) -> dict | None:
        return self._idempotency.get(key)

    def save_export_job(self, job_id: uuid.UUID, row: dict) -> None:
        self._export_jobs[job_id] = row

    def get_export_job(self, job_id: uuid.UUID) -> dict | None:
        return self._export_jobs.get(job_id)

    def save_export_token(self, token: str, dashboard_id: uuid.UUID, expires_at: float) -> None:
        self._export_tokens[token] = {"dashboard_id": dashboard_id, "expires_at": expires_at}

    def get_export_token(self, token: str) -> dict | None:
        return self._export_tokens.get(token)

    def delete_export_token(self, token: str) -> None:
        self._export_tokens.pop(token, None)


class DbScheduleStore(ScheduleStore):
    def get(self, schedule_id: uuid.UUID) -> dict | None:
        with Session(bind=get_meta_engine()) as db:
            model = db.get(ReportSchedule, schedule_id)
            return _schedule_to_row(model) if model else None

    def save(self, row: dict) -> dict:
        with Session(bind=get_meta_engine()) as db:
            model = db.get(ReportSchedule, row["id"])
            if model is None:
                model = ReportSchedule(id=row["id"])
                db.add(model)
            model.name = row.get("name")
            model.catalog_node_id = row.get("catalog_node_id")
            model.source_type = row.get("source_type", "template")
            model.source_id = row.get("source_id")
            model.source_key = row.get("source_key")
            model.owner_id = row.get("owner_id")
            model.recipients = row.get("recipients") or []
            model.attachment_formats = row.get("attachment_formats") or ["pdf"]
            model.delivery_channels = row.get("delivery_channels") or ["email"]
            model.email_smtp_slot = row.get("email_smtp_slot") or "qq"
            model.cron = row["cron"]
            model.timezone = row.get("timezone", "Asia/Shanghai")
            model.status = row["status"]
            db.commit()
            db.refresh(model)
            return _schedule_to_row(model)

    def list_all(self) -> list[dict]:
        with Session(bind=get_meta_engine()) as db:
            models = db.scalars(select(ReportSchedule)).all()
            return [_schedule_to_row(m) for m in models]

    def delete(self, schedule_id: uuid.UUID) -> bool:
        with Session(bind=get_meta_engine()) as db:
            model = db.get(ReportSchedule, schedule_id)
            if model is None:
                return False
            exec_ids = list(
                db.scalars(
                    select(ReportScheduleExecution.id).where(
                        ReportScheduleExecution.schedule_id == schedule_id,
                    ),
                ).all(),
            )
            if exec_ids:
                db.query(ReportDeliveryAttempt).filter(
                    ReportDeliveryAttempt.execution_id.in_(exec_ids),
                ).delete(synchronize_session=False)
                db.query(ReportDismissedFailure).filter(
                    ReportDismissedFailure.execution_id.in_(exec_ids),
                ).delete(synchronize_session=False)
            db.query(ReportScheduleExecution).filter(
                ReportScheduleExecution.schedule_id == schedule_id,
            ).delete(synchronize_session=False)
            db.query(ScheduleTickLock).filter(
                ScheduleTickLock.schedule_id == schedule_id,
            ).delete(synchronize_session=False)
            db.delete(model)
            db.commit()
            return True

    def clear(self) -> None:
        with Session(bind=get_meta_engine()) as db:
            db.query(ReportScheduleExecution).delete()
            db.query(ReportSchedule).delete()
            db.query(DashboardExportJob).delete()
            db.query(ExportToken).delete()
            db.query(ScheduleTickLock).delete()
            db.commit()

    def append_execution(self, schedule_id: uuid.UUID, entry: dict, out_data: dict | None = None) -> None:
        with Session(bind=get_meta_engine()) as db:
            existing = db.get(ReportScheduleExecution, entry["executionId"])
            if existing is not None:
                existing.status = entry["status"]
                existing.artifact_ref = entry["artifactRef"]
                existing.artifact_kind = entry.get("artifactKind")
                existing.artifact_storage_key = entry.get("artifactStorageKey")
                existing.secondary_artifacts = entry.get("secondaryArtifacts")
                existing.error_message = entry.get("errorMessage")
                existing.parent_execution_id = entry.get("parentExecutionId")
                if out_data:
                    existing.delivery_steps = out_data.get("deliverySteps")
                    existing.idempotency_key = out_data.get("idempotencyKey")
                    existing.revision_snapshot = out_data.get("revisionSnapshot")
                db.commit()
                return
            db.add(ReportScheduleExecution(
                id=entry["executionId"],
                schedule_id=schedule_id,
                status=entry["status"],
                artifact_ref=entry["artifactRef"],
                artifact_kind=entry.get("artifactKind"),
                artifact_storage_key=entry.get("artifactStorageKey"),
                secondary_artifacts=entry.get("secondaryArtifacts"),
                error_message=entry.get("errorMessage"),
                delivery_steps=out_data.get("deliverySteps") if out_data else None,
                idempotency_key=out_data.get("idempotencyKey") if out_data else None,
                parent_execution_id=entry.get("parentExecutionId"),
                revision_snapshot=out_data.get("revisionSnapshot") if out_data else None,
            ))
            db.commit()

    def list_executions(self, schedule_id: uuid.UUID) -> list[dict]:
        with Session(bind=get_meta_engine()) as db:
            models = db.scalars(
                select(ReportScheduleExecution)
                .where(ReportScheduleExecution.schedule_id == schedule_id)
                .order_by(ReportScheduleExecution.executed_at.desc()),
            ).all()
            return [_execution_to_dict(m) for m in models]

    def get_execution(self, execution_id: uuid.UUID) -> dict | None:
        with Session(bind=get_meta_engine()) as db:
            m = db.get(ReportScheduleExecution, execution_id)
            return _execution_to_dict(m) if m else None

    def list_all_executions(self) -> list[dict]:
        with Session(bind=get_meta_engine()) as db:
            models = db.scalars(select(ReportScheduleExecution)).all()
            return [_execution_to_dict(m) for m in models]

    def cache_idempotency(self, key: str, out: dict) -> None:
        with Session(bind=get_meta_engine()) as db:
            existing = db.scalar(
                select(ReportScheduleExecution).where(ReportScheduleExecution.idempotency_key == key),
            )
            if existing is not None:
                return
            exec_id = out.get("executionId")
            schedule_id = out.get("scheduleId")
            if exec_id is None or schedule_id is None:
                return
            row = db.get(ReportScheduleExecution, exec_id)
            if row is not None:
                row.idempotency_key = key
                db.commit()
                return
            db.add(ReportScheduleExecution(
                id=exec_id,
                schedule_id=schedule_id,
                status=out.get("status", ""),
                artifact_ref=out.get("artifactRef", ""),
                artifact_kind=out.get("artifactKind"),
                error_message=out.get("errorMessage"),
                delivery_steps=out.get("deliverySteps"),
                idempotency_key=key,
                parent_execution_id=out.get("parentExecutionId"),
                revision_snapshot=out.get("revisionSnapshot"),
            ))
            db.commit()

    def get_idempotency(self, key: str) -> dict | None:
        with Session(bind=get_meta_engine()) as db:
            m = db.scalar(
                select(ReportScheduleExecution).where(ReportScheduleExecution.idempotency_key == key),
            )
            return _execution_to_dict(m) if m else None


_memory_store = MemoryScheduleStore()


def get_schedule_store(settings: Settings | None = None) -> ScheduleStore:
    settings = settings or get_settings()
    if settings.rpt_schedule_store == "db":
        return DbScheduleStore()
    return _memory_store


def get_active_store() -> MemoryScheduleStore | DbScheduleStore:
    store = get_schedule_store()
    if isinstance(store, MemoryScheduleStore):
        return store
    return store


def reset_schedules_for_tests() -> None:
    _memory_store.clear()
    from app.reports.artifact_store import reset_artifact_store_for_tests

    reset_artifact_store_for_tests()
    try:
        DbScheduleStore().clear()
    except Exception:
        pass


def try_acquire_tick_lock(schedule_id: uuid.UUID, tick_key: str) -> bool:
    settings = get_settings()
    if settings.rpt_schedule_store != "db":
        return True
    with Session(bind=get_meta_engine()) as db:
        existing = db.scalar(
            select(ScheduleTickLock).where(ScheduleTickLock.tick_key == tick_key),
        )
        if existing is not None:
            return False
        db.add(ScheduleTickLock(schedule_id=schedule_id, tick_key=tick_key))
        try:
            db.commit()
            return True
        except Exception:
            db.rollback()
            return False
