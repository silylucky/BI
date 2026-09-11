from __future__ import annotations

import uuid
from datetime import UTC, datetime

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.auth.deps import UserContext
from app.core.config import get_settings
from app.reports.scheduler import service as scheduler_service
from app.reports.scheduler.executor import semi_real_execute_schedule
from app.reports.scheduler.store import try_acquire_tick_lock

_scheduler: BackgroundScheduler | None = None
_SYSTEM_ACTOR = UserContext(id="schedule-system", username="schedule-system", roles=["admin"])


def get_report_scheduler() -> BackgroundScheduler:
    global _scheduler
    if _scheduler is None:
        _scheduler = BackgroundScheduler(timezone="Asia/Shanghai")
    return _scheduler


def _tick_execute(schedule_id: str) -> None:
    # M1 单机：每进程内 APScheduler 注册 cron；多副本部署前须集中调度或 leader 选举，避免重复触发。
    settings = get_settings()
    if not settings.rpt_scheduler_enabled:
        return
    sid = uuid.UUID(schedule_id)
    tick_key = f"{schedule_id}-{datetime.now(UTC).strftime('%Y%m%d%H%M')}"
    if not try_acquire_tick_lock(sid, tick_key):
        return
    key = f"cron-{schedule_id}-{uuid.uuid4().hex[:8]}"
    semi_real_execute_schedule(sid, key, _SYSTEM_ACTOR)


def register_job_on_transition(schedule_id: uuid.UUID, row: dict) -> None:
    if row["status"] != "scheduled":
        return
    if not get_settings().rpt_scheduler_enabled:
        return
    scheduler = get_report_scheduler()
    scheduler.add_job(
        _tick_execute,
        trigger=CronTrigger.from_crontab(row["cron"], timezone=row["timezone"]),
        id=str(schedule_id),
        kwargs={},
        replace_existing=True,
        args=[str(schedule_id)],
    )


def remove_job_on_cancel(schedule_id: uuid.UUID) -> None:
    scheduler = get_report_scheduler()
    job_id = str(schedule_id)
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)


def refresh_schedule_jobs() -> None:
    if not get_settings().rpt_scheduler_enabled:
        return
    scheduler = get_report_scheduler()
    for job in scheduler.get_jobs():
        scheduler.remove_job(job.id)
    for row in scheduler_service.iter_scheduled_rows():
        register_job_on_transition(row["id"], row)
