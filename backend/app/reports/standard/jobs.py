from __future__ import annotations

import logging

from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.core.config import get_settings
from app.datasources.models import get_meta_engine
from app.reports.persistence import standard_repo
from app.reports.standard.snapshot import capture_all_enabled_themes
from app.reports.scheduler.jobs import get_report_scheduler

logger = logging.getLogger(__name__)

_SYSTEM_ACTOR = UserContext(id="standard-snapshot", username="standard-snapshot", roles=["admin"])

_CRON_BY_PRESET = {
    "daily": "0 1 * * *",
    "weekly": "0 2 * * 1",
    "monthly": "0 3 1 * *",
}


def _capture_pack(pack_key: str) -> None:
    settings = get_settings()
    if not settings.rpt_scheduler_enabled:
        return
    with Session(bind=get_meta_engine()) as db:
        try:
            capture_all_enabled_themes(db, pack_key, _SYSTEM_ACTOR)
        except Exception:
            logger.warning("standard_snapshot_capture_failed", extra={"packKey": pack_key}, exc_info=True)


def refresh_standard_snapshot_jobs() -> None:
    if not get_settings().rpt_scheduler_enabled:
        return
    scheduler = get_report_scheduler()
    for job in scheduler.get_jobs():
        if str(job.id).startswith("std-snap-"):
            scheduler.remove_job(job.id)
    for key, raw in standard_repo.all_packs().items():
        preset = raw.get("snapshotCronPreset", "daily")
        cron = _CRON_BY_PRESET.get(preset, _CRON_BY_PRESET["daily"])
        job_id = f"std-snap-{key}"
        scheduler.add_job(
            _capture_pack,
            trigger=CronTrigger.from_crontab(cron, timezone="Asia/Shanghai"),
            id=job_id,
            replace_existing=True,
            args=[key],
        )
