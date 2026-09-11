"""同步运行协作式取消（阶段边界生效，不硬杀连接）。"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ingestion.models import SyncRun

ACTIVE_RUN_STATUSES = frozenset({"running", "cancelling"})
CANCEL_MESSAGE = "用户已停止同步"


class SyncCancelled(Exception):
    """运行已被请求取消，执行器应中止后续阶段。"""


def find_active_run(db: Session, job_id: uuid.UUID) -> SyncRun | None:
    return db.scalar(
        select(SyncRun)
        .where(SyncRun.job_id == job_id, SyncRun.status.in_(tuple(ACTIVE_RUN_STATUSES)))
        .order_by(SyncRun.started_at.desc())
        .limit(1)
    )


def request_cancel_run(db: Session, run: SyncRun) -> SyncRun:
    """将 running 标记为 cancelling；已 cancelling/cancelled 则幂等返回。"""
    if run.status == "cancelled":
        return run
    if run.status == "cancelling":
        return run
    if run.status != "running":
        raise ValueError(f"无法停止状态为 {run.status} 的运行")
    run.status = "cancelling"
    run.error_message = CANCEL_MESSAGE
    db.commit()
    db.refresh(run)
    return run


def finalize_cancelled(db: Session, run: SyncRun) -> None:
    run.status = "cancelled"
    run.finished_at = datetime.now(timezone.utc)
    run.error_message = CANCEL_MESSAGE
    db.commit()


def raise_if_cancel_requested(db: Session, run: SyncRun) -> None:
    db.refresh(run)
    if run.status in {"cancelling", "cancelled"}:
        raise SyncCancelled()
