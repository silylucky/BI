"""同步成功后消费链编排：登记分析库 → Dataset → query 绑定。"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.datasources.metadata.service import list_columns
from app.datasources.service import DataSourceError
from app.ingestion.analytics_datasource import (
    can_connect_analytics_pg,
    ensure_analytics_datasource,
    resolve_analytics_connection,
    resolve_analytics_datasource_id,
)
from app.ingestion.models import SyncJob, EtlRuleSet
from app.metadata.dataset.models import DatasetRecord
from app.metadata.dataset.schemas import DatasetItemIn, DatasetTableDef
from app.metadata.dataset import service as dataset_service
from app.metadata.dataset.suggest_bind_columns import suggest_bind_columns
from app.metadata.dataset.errors import DatasetError
from app.query.config_store.schemas import ConfigUpsert
from app.query.config_store.service import upsert_config

logger = logging.getLogger(__name__)

NextAction = Literal["prepare", "ensure_dataset", "open_dashboard"]
ConsumeLabel = Literal["ready", "pending_dataset", "pending_prepare"]


class SyncConsumeError(Exception):
    def __init__(self, code: str, message: str, status: int = 422) -> None:
        self.code = code
        self.message = message
        self.status = status
        super().__init__(message)


@dataclass(frozen=True)
class PrepareResult:
    analytics_datasource_id: uuid.UUID | None
    analytics_ready: bool
    created: bool


@dataclass(frozen=True)
class ConsumePipelineStatus:
    target_table: str
    suggested_dataset_id: str
    analytics_datasource_id: uuid.UUID | None
    analytics_ready: bool
    dataset_id: str
    dataset_exists: bool
    dataset_bound: bool
    next_action: NextAction
    consume_label: ConsumeLabel
    etl_rules_configured: bool = False
    etl_rules_count: int = 0


@dataclass(frozen=True)
class EnsureDatasetResult:
    dataset_id: str
    bound_config_id: uuid.UUID
    created: bool
    bound: bool


@dataclass(frozen=True)
class RefreshDatasetBindingResult:
    dataset_id: str
    bound_config_id: uuid.UUID
    display_name: str
    columns: list[str]
    refreshed: bool


def _stable_ref_id(dataset_id: str) -> uuid.UUID:
    return uuid.uuid5(uuid.NAMESPACE_DNS, f"vitalspan.sync.dataset.{dataset_id}")


def _dataset_id_for_job(job: SyncJob) -> str:
    return job.target_table


def _sync_dataset_display_name(job: SyncJob) -> str:
    name = job.name.strip()
    return f"同步：{name}" if name else job.target_table


def prepare_sync_consume(db: Session) -> PrepareResult:
    """幂等登记托管分析库数据源（仅使用服务端 ANALYTICS_DATABASE_URL）。"""
    conn = resolve_analytics_connection()
    if conn is None:
        return PrepareResult(analytics_datasource_id=None, analytics_ready=False, created=False)
    if not can_connect_analytics_pg(conn):
        return PrepareResult(analytics_datasource_id=None, analytics_ready=False, created=False)
    before = resolve_analytics_datasource_id(db)
    ds_id = ensure_analytics_datasource(db)
    created = before is None and ds_id is not None
    ready = ds_id is not None and can_connect_analytics_pg(conn)
    return PrepareResult(
        analytics_datasource_id=ds_id,
        analytics_ready=ready,
        created=created,
    )


def _etl_rules_configured(db: Session, job_id: uuid.UUID) -> bool:
    rules_row = db.scalar(select(EtlRuleSet).where(EtlRuleSet.job_id == job_id))
    return bool(rules_row and rules_row.rules)


def _etl_rules_count(db: Session, job_id: uuid.UUID) -> int:
    rules_row = db.scalar(select(EtlRuleSet).where(EtlRuleSet.job_id == job_id))
    if rules_row is None:
        return 0
    return len(rules_row.rules or [])


def resolve_consume_status(db: Session, job: SyncJob) -> ConsumePipelineStatus:
    """汇总同步任务的消费管道状态（不触发副作用）。"""
    conn = resolve_analytics_connection()
    analytics_id = resolve_analytics_datasource_id(db)
    analytics_ready = (
        analytics_id is not None
        and conn is not None
        and can_connect_analytics_pg(conn)
    )
    dataset_id = _dataset_id_for_job(job)
    row = db.get(DatasetRecord, dataset_id)
    dataset_exists = row is not None
    dataset_bound = bool(row and row.bound_config_id)

    if not analytics_ready:
        next_action: NextAction = "prepare"
        consume_label: ConsumeLabel = "pending_prepare"
    elif not dataset_exists or not dataset_bound:
        next_action = "ensure_dataset"
        consume_label = "pending_dataset"
    else:
        next_action = "open_dashboard"
        consume_label = "ready"

    return ConsumePipelineStatus(
        target_table=job.target_table,
        suggested_dataset_id=dataset_id,
        analytics_datasource_id=analytics_id,
        analytics_ready=analytics_ready,
        dataset_id=dataset_id,
        dataset_exists=dataset_exists,
        dataset_bound=dataset_bound,
        next_action=next_action,
        consume_label=consume_label,
        etl_rules_configured=_etl_rules_configured(db, job.id),
        etl_rules_count=_etl_rules_count(db, job.id),
    )


def _list_table_columns(
    db: Session,
    actor: UserContext,
    data_source_id: uuid.UUID,
    schema: str,
    table: str,
) -> list[str]:
    try:
        resp = list_columns(db, list(actor.roles), data_source_id, schema, table)
    except DataSourceError as exc:
        raise SyncConsumeError(exc.code, exc.message, exc.status) from exc
    return [col.name for col in resp.items]


def _bind_dataset_query(
    db: Session,
    *,
    dataset_id: str,
    data_source_id: uuid.UUID,
    schema: str,
    table: str,
    columns: list[str],
    actor: UserContext,
) -> uuid.UUID:
    record = upsert_config(
        db,
        ConfigUpsert.model_validate(
            {
                "configType": "dataset_query",
                "schemaVersion": "1.0",
                "refType": "dataset",
                "refId": str(_stable_ref_id(dataset_id)),
                "payload": {
                    "dataSourceId": str(data_source_id),
                    "connectorType": "postgresql",
                    "schema": schema,
                    "table": table,
                    "columns": columns,
                    "conditions": {"logic": "AND", "conditions": []},
                    "limit": 1000,
                    "offset": 0,
                },
            },
        ),
        owner_id=uuid.UUID(actor.id),
    )
    row = db.get(DatasetRecord, dataset_id)
    if row is None:
        raise SyncConsumeError("META_DATASET_NOT_FOUND", "Dataset 不存在", 404)
    row.bound_config_id = record.id
    db.commit()
    return record.id


def ensure_dataset_for_sync_job(
    db: Session,
    job: SyncJob,
    actor: UserContext,
) -> EnsureDatasetResult:
    """一键创建 Dataset 并绑定 dataset_query（幂等）。"""
    prep = prepare_sync_consume(db)
    if not prep.analytics_ready or prep.analytics_datasource_id is None:
        raise SyncConsumeError(
            "ANALYTICS_DB_NOT_CONFIGURED",
            "托管分析库未配置或不可达，请先配置 ANALYTICS_DATABASE_URL 并确保分析库可连接",
            503,
        )

    dataset_id = _dataset_id_for_job(job)
    schema = "public"
    table = job.target_table
    qualified = f"{schema}.{table}"
    ds_id = prep.analytics_datasource_id

    row = db.get(DatasetRecord, dataset_id)
    created = False
    if row is None:
        try:
            dataset_service.create_dataset(
                DatasetItemIn(
                    dataset_id=dataset_id,
                    display_name=_sync_dataset_display_name(job),
                    tables=[DatasetTableDef(name=qualified)],
                    table_source_datasource_id=ds_id,
                ),
                actor,
            )
            created = True
        except DatasetError as exc:
            if exc.code != "META_DATASET_CONFLICT":
                raise SyncConsumeError(exc.code, exc.message, exc.status) from exc
        row = db.get(DatasetRecord, dataset_id)

    if row is None:
        raise SyncConsumeError("META_DATASET_CREATE_FAILED", "Dataset 创建失败", 500)

    if not created:
        if row.origin not in ("sync_job", None, "") or (
            row.sync_job_id is not None and row.sync_job_id != job.id
        ):
            raise SyncConsumeError(
                "SYNC_DATASET_CONFLICT",
                f"Dataset「{dataset_id}」已存在且不属于本同步任务，请更换目标表名",
                409,
            )
    row.origin = "sync_job"
    row.sync_job_id = job.id
    db.commit()

    if row.bound_config_id is not None:
        return EnsureDatasetResult(
            dataset_id=dataset_id,
            bound_config_id=row.bound_config_id,
            created=created,
            bound=False,
        )

    all_columns = _list_table_columns(db, actor, ds_id, schema, table)
    if not all_columns:
        raise SyncConsumeError(
            "SYNC_CONSUME_NO_COLUMNS",
            f"目标表 {qualified} 无可用列，请确认同步已成功写入分析库",
            422,
        )
    bind_columns = suggest_bind_columns(all_columns)

    bound_id = _bind_dataset_query(
        db,
        dataset_id=dataset_id,
        data_source_id=ds_id,
        schema=schema,
        table=table,
        columns=bind_columns,
        actor=actor,
    )
    logger.info(
        "sync_consume_dataset_ready job=%s dataset=%s bound=%s created=%s",
        job.id,
        dataset_id,
        bound_id,
        created,
    )
    return EnsureDatasetResult(
        dataset_id=dataset_id,
        bound_config_id=bound_id,
        created=created,
        bound=True,
    )


def refresh_dataset_binding_for_sync_job(
    db: Session,
    job: SyncJob,
    actor: UserContext,
) -> RefreshDatasetBindingResult:
    """刷新同步产物 Dataset 显示名与出图绑定列（自动识别，幂等可重复）。"""
    prep = prepare_sync_consume(db)
    if not prep.analytics_ready or prep.analytics_datasource_id is None:
        raise SyncConsumeError(
            "ANALYTICS_DB_NOT_CONFIGURED",
            "托管分析库未配置或不可达，请先配置 ANALYTICS_DATABASE_URL 并确保分析库可连接",
            503,
        )

    dataset_id = _dataset_id_for_job(job)
    schema = "public"
    table = job.target_table
    qualified = f"{schema}.{table}"
    ds_id = prep.analytics_datasource_id

    row = db.get(DatasetRecord, dataset_id)
    if row is None:
        raise SyncConsumeError(
            "META_DATASET_NOT_FOUND",
            "Dataset 不存在，请先一键创建 Dataset",
            422,
        )

    display_name = _sync_dataset_display_name(job)
    row.display_name = display_name
    row.table_source_datasource_id = ds_id
    if row.origin not in ("sync_job", None, "") or (
        row.sync_job_id is not None and row.sync_job_id != job.id
    ):
        raise SyncConsumeError(
            "SYNC_DATASET_CONFLICT",
            f"Dataset「{dataset_id}」已存在且不属于本同步任务，请更换目标表名",
            409,
        )
    row.origin = "sync_job"
    row.sync_job_id = job.id
    db.commit()

    all_columns = _list_table_columns(db, actor, ds_id, schema, table)
    if not all_columns:
        raise SyncConsumeError(
            "SYNC_CONSUME_NO_COLUMNS",
            f"目标表 {qualified} 无可用列，请确认同步已成功写入分析库",
            422,
        )
    bind_columns = suggest_bind_columns(all_columns)
    bound_id = _bind_dataset_query(
        db,
        dataset_id=dataset_id,
        data_source_id=ds_id,
        schema=schema,
        table=table,
        columns=bind_columns,
        actor=actor,
    )
    logger.info(
        "sync_consume_dataset_refreshed job=%s dataset=%s bound=%s columns=%s",
        job.id,
        dataset_id,
        bound_id,
        len(bind_columns),
    )
    return RefreshDatasetBindingResult(
        dataset_id=dataset_id,
        bound_config_id=bound_id,
        display_name=display_name,
        columns=bind_columns,
        refreshed=True,
    )


def best_effort_prepare_after_sync(db: Session) -> str | None:
    """同步成功后 best-effort 登记分析库；失败返回警告文案。"""
    try:
        result = prepare_sync_consume(db)
        if result.analytics_ready:
            logger.info(
                "sync_consume_auto_prepare ok ds=%s created=%s",
                result.analytics_datasource_id,
                result.created,
            )
            return None
        logger.warning("sync_consume_auto_prepare skipped analytics not ready")
        return "同步后自动准备出图环境未完成：托管分析库不可达或未配置"
    except Exception as exc:
        logger.warning("sync_consume_auto_prepare_failed", exc_info=True)
        return f"同步后自动准备出图环境失败：{exc}"[:500]
