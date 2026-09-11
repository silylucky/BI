from __future__ import annotations

import logging

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import select

from app.ingestion.cron_validate import validate_schedule_cron
from app.ingestion.models import SyncJob, get_meta_session
from app.ingestion.sync_executor import STALE_RUN_MAX_AGE_SECONDS, reconcile_stale_running_runs, run_job

logger = logging.getLogger(__name__)

_scheduler: BackgroundScheduler | None = None


def get_scheduler() -> BackgroundScheduler:
    global _scheduler
    if _scheduler is None:
        _scheduler = BackgroundScheduler(timezone="Asia/Shanghai")
    return _scheduler


def refresh_all_jobs() -> None:
    scheduler = get_scheduler()
    for job in scheduler.get_jobs():
        if job.id == "ingestion_reconcile_stale_runs":
            continue
        scheduler.remove_job(job.id)
    db = get_meta_session()
    try:
        jobs = db.scalars(select(SyncJob).where(SyncJob.enabled.is_(True))).all()
        for job in jobs:
            if not job.schedule_cron:
                continue
            try:
                validate_schedule_cron(job.schedule_cron)
                scheduler.add_job(
                    run_job,
                    trigger=CronTrigger.from_crontab(job.schedule_cron),
                    id=str(job.id),
                    kwargs={"job_id": job.id, "trace_id": f"schedule-{job.id}"},
                    replace_existing=True,
                )
            except Exception as exc:
                logger.warning(
                    "sync_scheduler_skip_invalid_cron job_id=%s cron=%s err=%s",
                    job.id,
                    job.schedule_cron,
                    exc,
                )
                continue
    finally:
        db.close()


def register_stale_run_reconcile(
    *,
    interval_minutes: int = 1,
    max_age_seconds: int = STALE_RUN_MAX_AGE_SECONDS,
) -> None:
    """周期清理僵死 running 同步记录（进程中断或源/分析库挂起）。"""
    scheduler = get_scheduler()
    scheduler.add_job(
        reconcile_stale_running_runs,
        trigger=IntervalTrigger(minutes=interval_minutes),
        id="ingestion_reconcile_stale_runs",
        kwargs={"max_age_seconds": max_age_seconds},
        replace_existing=True,
    )
