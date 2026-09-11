"""同步运行启动前互斥与目标表占用检查。"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.datasources.source_health import resolve_sync_job_source_health
from app.ingestion.models import SyncJob, SyncRun
from app.ingestion.sync_cancel import find_active_run
from app.ingestion.sync_source_capabilities import resolve_sync_fetch_mode
from app.ingestion.target_table_guard import TargetTableBusyError, assert_target_table_not_busy

logger = logging.getLogger(__name__)


class SyncRunSkipped(Exception):
    """定时触发时因互斥跳过，不创建运行记录。"""


def assert_job_runnable(db: Session, job: SyncJob) -> None:
    if resolve_sync_job_source_health(db, job) == "missing":
        raise RuntimeError("任务引用的数据连接已删除或不可见，无法运行同步")
    if job.sync_mode == "incremental" and resolve_sync_fetch_mode(job.source_type) == "native":
        raise RuntimeError("增量同步不支持 Native 源，请改用 SQL 表源或切换为全量同步")


def guard_scheduled_sync_start(db: Session, job: SyncJob) -> None:
    assert_job_runnable(db, job)
    if find_active_run(db, job.id) is not None:
        logger.info("sync_scheduled_skipped job_id=%s reason=active_run", job.id)
        raise SyncRunSkipped("该任务正在运行中")
    try:
        assert_target_table_not_busy(db, job.target_table, exclude_job_id=job.id)
    except TargetTableBusyError as exc:
        logger.info(
            "sync_scheduled_skipped job_id=%s reason=target_table_busy table=%s",
            job.id,
            job.target_table,
        )
        raise SyncRunSkipped(str(exc)) from exc


def guard_api_sync_start(db: Session, job: SyncJob) -> None:
    assert_job_runnable(db, job)
    try:
        assert_target_table_not_busy(db, job.target_table, exclude_job_id=job.id)
    except TargetTableBusyError as exc:
        raise RuntimeError(str(exc)) from exc


def fail_run_for_guard(db: Session, run_id: uuid.UUID, message: str) -> None:
    run = db.get(SyncRun, run_id)
    if run is None:
        return
    run.status = "failed"
    run.finished_at = datetime.now(timezone.utc)
    run.error_message = message[:500]
    db.commit()
