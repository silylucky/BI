"""数据源引用健康状态（列表/详情提示用）。"""

from __future__ import annotations

import uuid
from typing import Literal

from sqlalchemy.orm import Session

from app.datasources.models import DataSource
from app.ingestion.models import SyncJob
from app.metadata.dataset.models import DatasetRecord
from app.query.config_store.models import QueryConfigRecord

SourceHealth = Literal["active", "missing", "none"]


def resolve_datasource_health(session: Session, ds_id: uuid.UUID | None) -> SourceHealth:
    if ds_id is None:
        return "none"
    row = session.get(DataSource, ds_id)
    if row is None or row.deleted_at is not None:
        return "missing"
    return "active"


def resolve_dataset_source_health(session: Session, row: DatasetRecord) -> SourceHealth:
    ds_id = row.table_source_datasource_id
    if ds_id is None and row.bound_config_id is not None:
        cfg = session.get(QueryConfigRecord, row.bound_config_id)
        if cfg is not None and isinstance(cfg.payload, dict):
            raw = cfg.payload.get("dataSourceId")
            if raw:
                try:
                    ds_id = uuid.UUID(str(raw))
                except ValueError:
                    pass
    return resolve_datasource_health(session, ds_id)


def resolve_sync_job_source_health(session: Session, job: SyncJob) -> SourceHealth:
    return resolve_datasource_health(session, job.source_data_source_id)
