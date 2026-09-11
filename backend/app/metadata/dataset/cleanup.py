"""Dataset 与同步任务 / 查询绑定的级联清理。"""

from __future__ import annotations

import logging
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ingestion.models import SyncJob
from app.metadata.dataset.demo_seed import is_demo_package_dataset
from app.metadata.dataset.models import DatasetRecord
from app.query.config_store.models import QueryConfigRecord

logger = logging.getLogger(__name__)


def _stable_ref_id(dataset_id: str) -> uuid.UUID:
    return uuid.uuid5(uuid.NAMESPACE_DNS, f"vitalspan.sync.dataset.{dataset_id}")


def _delete_bound_query_config(session: Session, row: DatasetRecord) -> None:
    if row.bound_config_id is not None:
        record = session.get(QueryConfigRecord, row.bound_config_id)
        if record is not None:
            session.delete(record)
    ref_id = _stable_ref_id(row.dataset_id)
    orphan = session.scalar(
        select(QueryConfigRecord)
        .where(
            QueryConfigRecord.config_type == "dataset_query",
            QueryConfigRecord.ref_type == "dataset",
            QueryConfigRecord.ref_id == ref_id,
        )
        .limit(1),
    )
    if orphan is not None:
        session.delete(orphan)


def delete_dataset_row(session: Session, row: DatasetRecord) -> bool:
    """删除 Dataset 及其 query 绑定；官方示例 Dataset 跳过。"""
    if is_demo_package_dataset(row.dataset_id, row.display_name):
        return False
    _delete_bound_query_config(session, row)
    session.delete(row)
    return True


def delete_datasets_for_sync_job(session: Session, job: SyncJob) -> list[str]:
    """删除同步任务衍生的 Dataset（幂等）。"""
    rows = list(
        session.scalars(
            select(DatasetRecord).where(
                (DatasetRecord.sync_job_id == job.id)
                | (
                    (DatasetRecord.dataset_id == job.target_table)
                    & (DatasetRecord.origin == "sync_job")
                ),
            ),
        ),
    )
    deleted: list[str] = []
    for row in rows:
        if delete_dataset_row(session, row):
            deleted.append(row.dataset_id)
    if deleted:
        logger.info("sync_job_dataset_cascade job=%s datasets=%s", job.id, deleted)
    return deleted


def purge_orphan_sync_datasets(session: Session) -> int:
    """清理 sync_job_id 指向已删除任务的同步产物 Dataset。"""
    active_job_ids = set(session.scalars(select(SyncJob.id)))
    orphans = list(
        session.scalars(
            select(DatasetRecord).where(DatasetRecord.origin == "sync_job"),
        ),
    )
    removed = 0
    for row in orphans:
        if row.sync_job_id is None or row.sync_job_id not in active_job_ids:
            if delete_dataset_row(session, row):
                removed += 1
    if removed:
        logger.info("purge_orphan_sync_datasets removed=%s", removed)
    return removed


def purge_datasets_with_missing_table_source(session: Session) -> int:
    """清理 table_source 指向已删除或不存在数据源的 Dataset（非同步产物、非官方示例）。"""
    from app.datasources.models import DataSource

    rows = list(
        session.scalars(
            select(DatasetRecord).where(
                DatasetRecord.table_source_datasource_id.is_not(None),
                DatasetRecord.origin != "sync_job",
            ),
        ),
    )
    removed = 0
    for row in rows:
        ds_id = row.table_source_datasource_id
        if ds_id is None:
            continue
        src = session.get(DataSource, ds_id)
        if src is None or src.deleted_at is not None:
            if delete_dataset_row(session, row):
                removed += 1
    if removed:
        logger.info("purge_datasets_with_missing_table_source removed=%s", removed)
    return removed
