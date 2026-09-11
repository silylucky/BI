from __future__ import annotations

from apscheduler.triggers.cron import CronTrigger


def validate_schedule_cron(value: str | None) -> None:
    if not value:
        return
    CronTrigger.from_crontab(value)
