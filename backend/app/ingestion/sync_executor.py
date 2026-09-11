from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.ingestion.etl_rules import apply_rules
from app.ingestion.models import EtlRuleSet, SyncJob, SyncRun, get_meta_session
from app.ingestion.sync_cancel import (
    SyncCancelled,
    finalize_cancelled,
    raise_if_cancel_requested,
)
from app.ingestion.sync_fetch import fetch_source_rows_result
from app.ingestion.sync_types import SyncFetchResult
from app.ingestion.sync_run_guard import (
    SyncRunSkipped,
    fail_run_for_guard,
    guard_api_sync_start,
    guard_scheduled_sync_start,
)
from app.ingestion.sync_write import write_analytics

__all__ = [
    "run_job",
    "reconcile_stale_running_runs",
    "validate_sync_table_names",
    "INGESTION_MAX_ROWS",
    "STALE_RUN_MAX_AGE_SECONDS",
]

from app.ingestion.models import INGESTION_MAX_ROWS  # noqa: E402
from app.ingestion.sync_fetch import validate_sync_table_names  # noqa: E402

STALE_RUN_MAX_AGE_SECONDS = 3600

_TRUNCATION_WARNING = (
    f"已同步 {INGESTION_MAX_ROWS} 行，源数据可能更多（已达单次上限）。"
    "请改用增量同步或缩小源表范围。"
)


def _coerce_fetch_result(raw: SyncFetchResult | list[dict[str, Any]]) -> SyncFetchResult:
    if isinstance(raw, SyncFetchResult):
        return raw
    return SyncFetchResult(rows=raw)


def _update_run(db: Session, run: SyncRun, **fields: Any) -> None:
    for key, value in fields.items():
        setattr(run, key, value)
    db.commit()


def _run_still_active(db: Session, run: SyncRun) -> bool:
    db.refresh(run)
    return run.status in {"running", "cancelling"}


def reconcile_stale_running_runs(*, max_age_seconds: int = STALE_RUN_MAX_AGE_SECONDS) -> int:
    """将超时仍停留在 running/cancelling 的记录标为失败（进程中断或源库连接挂起）。"""
    db = get_meta_session()
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(seconds=max_age_seconds)
        runs = db.scalars(
            select(SyncRun).where(
                SyncRun.status.in_(("running", "cancelling")),
                SyncRun.started_at < cutoff,
            ),
        ).all()
        if not runs:
            return 0
        now = datetime.now(timezone.utc)
        for run in runs:
            run.status = "failed"
            run.finished_at = now
            run.error_message = (
                "运行超时或进程中断，已自动标记失败。请检查业务源连接与分析库连通性后重试。"
            )
        db.commit()
        return len(runs)
    finally:
        db.close()


def run_job(job_id: uuid.UUID, trace_id: str, *, run_id: uuid.UUID | None = None, attempt: int = 0) -> uuid.UUID | None:
    db = get_meta_session()
    job = db.scalar(select(SyncJob).where(SyncJob.id == job_id).with_for_update())
    if job is None:
        if run_id is not None:
            fail_run_for_guard(db, run_id, "任务不存在")
        db.close()
        return run_id

    if run_id is None:
        try:
            guard_scheduled_sync_start(db, job)
        except SyncRunSkipped:
            db.close()
            return None
        run = SyncRun(job_id=job_id, status="running", trace_id=trace_id, retry_count=attempt)
        db.add(run)
        db.commit()
        db.refresh(run)
        run_id = run.id
    else:
        run = db.get(SyncRun, run_id)
        if run is None:
            db.close()
            raise ValueError("run not found")
        try:
            guard_api_sync_start(db, job)
        except RuntimeError as exc:
            fail_run_for_guard(db, run_id, str(exc))
            db.close()
            return run_id
    rules_row = db.scalar(select(EtlRuleSet).where(EtlRuleSet.job_id == job_id))
    rules = rules_row.rules if rules_row else []
    try:
        raise_if_cancel_requested(db, run)
        if not get_settings().analytics_database_url:
            raise RuntimeError("ANALYTICS_DB_NOT_CONFIGURED")
        fetch_result = _coerce_fetch_result(fetch_source_rows_result(job))
        raise_if_cancel_requested(db, run)
        cleaned = apply_rules(fetch_result.rows, rules)
        raise_if_cancel_requested(db, run)
        count = write_analytics(job, cleaned)
        raise_if_cancel_requested(db, run)
        next_watermark = compute_next_watermark(job, cleaned)
        if not _run_still_active(db, run):
            db.refresh(run)
            if run.status in {"cancelling", "cancelled"}:
                finalize_cancelled(db, run)
            return run_id
        consume_warning: str | None = None
        if fetch_result.truncated:
            consume_warning = _TRUNCATION_WARNING
        from app.ingestion.sync_consume import best_effort_prepare_after_sync

        prepare_warning = best_effort_prepare_after_sync(db)
        if prepare_warning:
            consume_warning = (
                f"{consume_warning} {prepare_warning}".strip()
                if consume_warning
                else prepare_warning
            )
        final_status = "succeeded_with_warnings" if consume_warning else "succeeded"
        if next_watermark is not None:
            job.last_watermark = next_watermark
        _update_run(
            db,
            run,
            status=final_status,
            finished_at=datetime.now(timezone.utc),
            rows_synced=count,
            rows_truncated=fetch_result.truncated,
            consume_warning=consume_warning,
            error_message=None,
        )
    except SyncCancelled:
        finalize_cancelled(db, run)
    except Exception as exc:  # noqa: BLE001 — 记录用户可读摘要
        db.refresh(run)
        if run.status in {"cancelling", "cancelled"}:
            finalize_cancelled(db, run)
            return run_id
        if attempt < 1:
            _update_run(db, run, retry_count=attempt + 1)
            db.close()
            run_job(job_id, trace_id, run_id=run_id, attempt=attempt + 1)
            return run_id
        _update_run(
            db,
            run,
            status="failed",
            finished_at=datetime.now(timezone.utc),
            error_message=str(exc)[:500],
        )
    finally:
        db.close()
    return run_id


from app.ingestion.sync_fetch import compute_next_watermark  # noqa: E402
