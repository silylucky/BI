"""同步任务 target_table 唯一性校验。"""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ingestion.models import SyncJob, SyncRun

SYNC_TARGET_TABLE_CONFLICT = "SYNC_TARGET_TABLE_CONFLICT"
SYNC_TARGET_TABLE_BUSY = "SYNC_TARGET_TABLE_BUSY"


class TargetTableConflictError(Exception):
    def __init__(self, target_table: str, job_names: list[str]) -> None:
        self.target_table = target_table
        self.job_names = job_names
        names = "、".join(job_names)
        super().__init__(
            f"目标表 {target_table} 已被任务「{names}」使用，请改用其他目标表名",
        )


def find_jobs_sharing_target_table(
    db: Session,
    target_table: str,
    *,
    exclude_job_id: uuid.UUID | None = None,
) -> list[SyncJob]:
    needle = target_table.strip().lower()
    if not needle:
        return []
    jobs = db.scalars(select(SyncJob)).all()
    return [
        job
        for job in jobs
        if job.target_table.strip().lower() == needle
        and (exclude_job_id is None or job.id != exclude_job_id)
    ]


def assert_unique_target_table(
    db: Session,
    target_table: str,
    *,
    exclude_job_id: uuid.UUID | None = None,
) -> None:
    conflicts = find_jobs_sharing_target_table(db, target_table, exclude_job_id=exclude_job_id)
    if conflicts:
        raise TargetTableConflictError(target_table, [job.name for job in conflicts])


class TargetTableBusyError(Exception):
    def __init__(self, target_table: str, job_names: list[str]) -> None:
        self.target_table = target_table
        self.job_names = job_names
        names = "、".join(job_names)
        super().__init__(
            f"目标表 {target_table} 正被任务「{names}」同步写入，请稍后再试",
        )


def find_running_jobs_on_target_table(
    db: Session,
    target_table: str,
    *,
    exclude_job_id: uuid.UUID | None = None,
) -> list[SyncJob]:
    needle = target_table.strip().lower()
    if not needle:
        return []
    jobs = db.scalars(
        select(SyncJob)
        .join(SyncRun, SyncRun.job_id == SyncJob.id)
        .where(
            SyncRun.status.in_(("running", "cancelling")),
            SyncJob.target_table.ilike(needle),
        )
        .distinct(),
    ).all()
    if exclude_job_id is None:
        return list(jobs)
    return [job for job in jobs if job.id != exclude_job_id]


def assert_target_table_not_busy(
    db: Session,
    target_table: str,
    *,
    exclude_job_id: uuid.UUID | None = None,
) -> None:
    busy = find_running_jobs_on_target_table(
        db, target_table, exclude_job_id=exclude_job_id,
    )
    if busy:
        raise TargetTableBusyError(target_table, [job.name for job in busy])
