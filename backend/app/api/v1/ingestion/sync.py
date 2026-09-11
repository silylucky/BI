from __future__ import annotations

import uuid
from typing import Annotated, Any, Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth.deps import UserContext, require_permission
from app.core.config import get_settings
from app.ingestion.sync_consume import (
    SyncConsumeError,
    ensure_dataset_for_sync_job,
    prepare_sync_consume,
    refresh_dataset_binding_for_sync_job,
    resolve_consume_status,
)
from app.ingestion.target_table_guard import (
    TargetTableConflictError,
    TargetTableBusyError,
    assert_target_table_not_busy,
    assert_unique_target_table,
)
from app.ingestion.etl_seed import resolve_initial_etl_rules
from app.datasources.models import DataSource
from app.ingestion.cron_validate import validate_schedule_cron
from app.ingestion.models import (
    EtlRuleSet,
    SourceConnectionIn,
    SourceConnectionOut,
    SourceConnectionUpdateIn,
    SyncJob,
    SyncRun,
    get_meta_session,
)
from app.ingestion.scheduler import refresh_all_jobs
from app.ingestion.source_resolver import (
    SourceResolverError,
    http_exception_from_resolver,
    resolve_and_apply_source,
)
from app.ingestion.sync_cancel import find_active_run, request_cancel_run
from app.ingestion.sync_executor import run_job
from app.metadata.dataset.cleanup import delete_datasets_for_sync_job
from app.datasources.source_health import resolve_sync_job_source_health
from app.query.rls.guard import validate_identifier

router = APIRouter(prefix="/ingestion", tags=["ingestion"])

PERM_READ = "ingestion:read"
PERM_MANAGE = "ingestion:manage"
PERM_DATASET_MANAGE = "dataset:manage"


def _validate_incremental_fields(
    sync_mode: str,
    primary_key: str | None,
    incremental_column: str | None,
) -> None:
    if sync_mode != "incremental":
        return
    if not primary_key or not incremental_column:
        raise ValueError("增量同步须指定 primary_key 与 incremental_column")
    validate_identifier(primary_key)
    validate_identifier(incremental_column)


class SyncJobCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    target_table: str
    schedule_cron: str | None = None
    enabled: bool = True
    sync_mode: Literal["full", "incremental"] = "full"
    primary_key: str | None = None
    incremental_column: str | None = None
    source_mode: Literal["inline", "datasource"] = "datasource"
    source_data_source_id: uuid.UUID | None = None
    source: SourceConnectionIn | None = None
    source_table: str | None = None
    source_schema: str | None = None

    @field_validator("schedule_cron")
    @classmethod
    def validate_cron(cls, value: str | None) -> str | None:
        if value:
            try:
                validate_schedule_cron(value)
            except Exception as exc:
                raise ValueError("Cron 表达式格式无效") from exc
        return value

    @field_validator("target_table")
    @classmethod
    def validate_target_table(cls, value: str) -> str:
        validate_identifier(value)
        return value

    @field_validator("source_table")
    @classmethod
    def validate_source_table_field(cls, value: str | None) -> str | None:
        if value is not None and not value.strip():
            raise ValueError("须指定 source_table")
        return value.strip() if value else value

    @field_validator("source_schema")
    @classmethod
    def validate_source_schema_field(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        validate_identifier(value.strip())
        return value.strip()

    @model_validator(mode="after")
    def validate_modes(self) -> SyncJobCreate:
        _validate_incremental_fields(self.sync_mode, self.primary_key, self.incremental_column)
        if self.source_mode == "inline":
            raise ValueError("内联模式已停用，请在连接管理登记 MySQL 后使用 datasource 模式")
        if self.source_data_source_id is None:
            raise ValueError("须指定 source_data_source_id")
        table = self.source_table or (self.source.table if self.source else None)
        if not table:
            raise ValueError("须指定 source_table")
        object.__setattr__(self, "source_table", table.strip())
        return self


class SyncJobUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    target_table: str
    schedule_cron: str | None = None
    enabled: bool = True
    sync_mode: Literal["full", "incremental"] = "full"
    primary_key: str | None = None
    incremental_column: str | None = None
    source_mode: Literal["inline", "datasource"] = "datasource"
    source_data_source_id: uuid.UUID | None = None
    source: SourceConnectionUpdateIn | None = None
    source_table: str | None = None
    source_schema: str | None = None

    @field_validator("schedule_cron")
    @classmethod
    def validate_cron(cls, value: str | None) -> str | None:
        if value:
            try:
                validate_schedule_cron(value)
            except Exception as exc:
                raise ValueError("Cron 表达式格式无效") from exc
        return value

    @field_validator("target_table")
    @classmethod
    def validate_target_table(cls, value: str) -> str:
        validate_identifier(value)
        return value

    @field_validator("source_table")
    @classmethod
    def validate_source_table_field(cls, value: str | None) -> str | None:
        if value is not None and not value.strip():
            raise ValueError("须指定 source_table")
        return value.strip() if value else value

    @field_validator("source_schema")
    @classmethod
    def validate_source_schema_field(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        validate_identifier(value.strip())
        return value.strip()

    @model_validator(mode="after")
    def validate_modes(self) -> SyncJobUpdate:
        _validate_incremental_fields(self.sync_mode, self.primary_key, self.incremental_column)
        if self.source_mode == "inline":
            raise ValueError("内联模式已停用，请在连接管理登记 MySQL 后使用 datasource 模式")
        if self.source_data_source_id is None:
            raise ValueError("须指定 source_data_source_id")
        table = self.source_table or (self.source.table if self.source else None)
        if not table:
            raise ValueError("须指定 source_table")
        object.__setattr__(self, "source_table", table.strip())
        return self


class SyncJobLastRun(BaseModel):
    status: str
    started_at: str
    finished_at: str | None
    rows_synced: int | None
    rows_truncated: bool = False
    consume_warning: str | None = None
    error_message: str | None


class SyncJobSummary(BaseModel):
    id: uuid.UUID
    name: str
    source_type: str
    source_database: str | None = None
    source_label: str | None = None
    target_table: str
    sync_mode: str
    enabled: bool
    schedule_cron: str | None
    source_data_source_id: uuid.UUID | None = None
    source_health: Literal["active", "missing", "none"] = "none"
    last_run: SyncJobLastRun | None = None
    consume_status: SyncJobConsumeLabel | None = None


class SyncJobDetail(SyncJobSummary):
    source: SourceConnectionOut
    primary_key: str | None = None
    incremental_column: str | None = None
    last_watermark: str | None = None


class SyncJobConsumeStatus(BaseModel):
    target_table: str = Field(alias="targetTable")
    suggested_dataset_id: str = Field(alias="suggestedDatasetId")
    analytics_datasource_id: uuid.UUID | None = Field(default=None, alias="analyticsDatasourceId")
    analytics_ready: bool = Field(alias="analyticsReady")
    dataset_id: str = Field(alias="datasetId")
    dataset_exists: bool = Field(alias="datasetExists")
    dataset_bound: bool = Field(alias="datasetBound")
    next_action: Literal["prepare", "ensure_dataset", "open_dashboard"] = Field(alias="nextAction")
    consume_label: Literal["ready", "pending_dataset", "pending_prepare"] = Field(alias="consumeLabel")
    etl_rules_configured: bool = Field(default=False, alias="etlRulesConfigured")
    etl_rules_count: int = Field(default=0, alias="etlRulesCount")

    model_config = {"populate_by_name": True}


class SyncJobConsumeHints(SyncJobConsumeStatus):
    """兼容旧字段名；与 ConsumePipelineStatus 同构。"""


class SyncJobConsumePrepareOut(BaseModel):
    analytics_datasource_id: uuid.UUID | None = Field(default=None, alias="analyticsDatasourceId")
    analytics_ready: bool = Field(alias="analyticsReady")
    created: bool

    model_config = {"populate_by_name": True}


class SyncJobEnsureDatasetOut(BaseModel):
    dataset_id: str = Field(alias="datasetId")
    bound_config_id: uuid.UUID = Field(alias="boundConfigId")
    created: bool
    bound: bool

    model_config = {"populate_by_name": True}


class SyncJobRefreshDatasetOut(BaseModel):
    dataset_id: str = Field(alias="datasetId")
    bound_config_id: uuid.UUID = Field(alias="boundConfigId")
    display_name: str = Field(alias="displayName")
    columns: list[str]
    refreshed: bool

    model_config = {"populate_by_name": True}


class SyncJobConsumeLabel(BaseModel):
    label: Literal["ready", "pending_dataset", "pending_prepare"]
    next_action: Literal["prepare", "ensure_dataset", "open_dashboard"]


class SyncJobListResponse(BaseModel):
    items: list[SyncJobSummary]


class EtlRulesPayload(BaseModel):
    rules: list[dict[str, Any]]

    @field_validator("rules", mode="before")
    @classmethod
    def rules_must_be_list(cls, value: Any) -> Any:
        if not isinstance(value, list):
            raise ValueError("规则须为 JSON 列表")
        return value


class EtlRulesResponse(BaseModel):
    rules: list[dict[str, Any]]


class SyncRunItem(BaseModel):
    id: uuid.UUID
    status: str
    started_at: str
    finished_at: str | None
    rows_synced: int | None
    rows_truncated: bool = False
    consume_warning: str | None = None
    error_message: str | None
    trace_id: str
    retry_count: int


class SyncRunListResponse(BaseModel):
    items: list[SyncRunItem]


class RunAccepted(BaseModel):
    run_id: uuid.UUID
    status: str


def _db() -> Session:
    session = get_meta_session()
    try:
        yield session
    finally:
        session.close()


def _to_source_out(job: SyncJob) -> SourceConnectionOut:
    return SourceConnectionOut(
        type=job.source_type,  # type: ignore[arg-type]
        host=job.source_host,
        port=job.source_port,
        database=job.source_database,
        source_schema=job.source_schema,
        username=job.source_username,
        table=job.source_table,
    )


def _apply_sync_mode_fields(job: SyncJob, payload: SyncJobCreate | SyncJobUpdate) -> None:
    job.sync_mode = payload.sync_mode
    job.primary_key = payload.primary_key if payload.sync_mode == "incremental" else None
    job.incremental_column = payload.incremental_column if payload.sync_mode == "incremental" else None
    if payload.sync_mode == "full":
        job.last_watermark = None


def _resolve_source_table(payload: SyncJobCreate | SyncJobUpdate) -> str | None:
    if payload.source_mode == "datasource":
        return payload.source_table
    return payload.source.table if payload.source else None


def _datasource_labels(db: Session, jobs: list[SyncJob]) -> dict[uuid.UUID, str]:
    ids = {j.source_data_source_id for j in jobs if j.source_data_source_id}
    if not ids:
        return {}
    rows = db.scalars(select(DataSource).where(DataSource.id.in_(ids))).all()
    return {row.id: row.name for row in rows if row.deleted_at is None}


def _last_runs_by_job_id(db: Session, job_ids: list[uuid.UUID]) -> dict[uuid.UUID, SyncRun]:
    if not job_ids:
        return {}
    subq = (
        select(SyncRun.job_id, func.max(SyncRun.started_at).label("max_started"))
        .where(SyncRun.job_id.in_(job_ids))
        .group_by(SyncRun.job_id)
        .subquery()
    )
    runs = db.scalars(
        select(SyncRun).join(
            subq,
            (SyncRun.job_id == subq.c.job_id) & (SyncRun.started_at == subq.c.max_started),
        )
    ).all()
    return {run.job_id: run for run in runs}


def _to_last_run(run: SyncRun | None) -> SyncJobLastRun | None:
    if run is None:
        return None
    return SyncJobLastRun(
        status=run.status,
        started_at=run.started_at.isoformat(),
        finished_at=run.finished_at.isoformat() if run.finished_at else None,
        rows_synced=run.rows_synced,
        rows_truncated=bool(getattr(run, "rows_truncated", False)),
        consume_warning=getattr(run, "consume_warning", None),
        error_message=run.error_message,
    )


def _status_to_hints(status) -> SyncJobConsumeHints:
    return SyncJobConsumeHints(
        target_table=status.target_table,
        suggested_dataset_id=status.suggested_dataset_id,
        analytics_datasource_id=status.analytics_datasource_id,
        analytics_ready=status.analytics_ready,
        dataset_id=status.dataset_id,
        dataset_exists=status.dataset_exists,
        dataset_bound=status.dataset_bound,
        next_action=status.next_action,
        consume_label=status.consume_label,
        etl_rules_configured=status.etl_rules_configured,
        etl_rules_count=status.etl_rules_count,
    )


def _to_summary(
    job: SyncJob,
    last_run: SyncRun | None,
    ds_labels: dict[uuid.UUID, str],
    consume_status=None,
    *,
    source_health: Literal["active", "missing", "none"] = "none",
) -> SyncJobSummary:
    label = ds_labels.get(job.source_data_source_id) if job.source_data_source_id else None
    consume_out = None
    if consume_status is not None:
        consume_out = SyncJobConsumeLabel(
            label=consume_status.consume_label,
            next_action=consume_status.next_action,
        )
    return SyncJobSummary(
        id=job.id,
        name=job.name,
        source_type=job.source_type,
        source_database=job.source_database,
        source_label=label,
        target_table=job.target_table,
        sync_mode=job.sync_mode,
        enabled=job.enabled,
        schedule_cron=job.schedule_cron,
        source_data_source_id=job.source_data_source_id,
        source_health=source_health,
        last_run=_to_last_run(last_run),
        consume_status=consume_out,
    )


def _to_detail(
    job: SyncJob,
    last_run: SyncRun | None,
    ds_labels: dict[uuid.UUID, str],
    consume_status=None,
    *,
    source_health: Literal["active", "missing", "none"] = "none",
) -> SyncJobDetail:
    summary = _to_summary(
        job, last_run, ds_labels, consume_status, source_health=source_health,
    )
    return SyncJobDetail(
        **summary.model_dump(),
        source=_to_source_out(job),
        primary_key=job.primary_key,
        incremental_column=job.incremental_column,
        last_watermark=job.last_watermark,
    )


_SUCCESSFUL_RUN_STATUSES = frozenset({"succeeded", "succeeded_with_warnings"})


def _should_resolve_consume_status(last: SyncRun | None) -> bool:
    return last is not None and last.status in _SUCCESSFUL_RUN_STATUSES


def _detail_for_job(db: Session, job: SyncJob) -> SyncJobDetail:
    last_runs = _last_runs_by_job_id(db, [job.id])
    last = last_runs.get(job.id)
    consume = None
    if _should_resolve_consume_status(last):
        consume = resolve_consume_status(db, job)
    ds_labels = _datasource_labels(db, [job])
    health = resolve_sync_job_source_health(db, job)
    return _to_detail(job, last, ds_labels, consume, source_health=health)


@router.get("/sync-jobs", response_model=SyncJobListResponse)
def list_sync_jobs(
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
) -> SyncJobListResponse:
    jobs = db.scalars(select(SyncJob).order_by(SyncJob.created_at.desc())).all()
    last_runs = _last_runs_by_job_id(db, [j.id for j in jobs])
    ds_labels = _datasource_labels(db, jobs)
    items = []
    for j in jobs:
        consume = None
        last = last_runs.get(j.id)
        if _should_resolve_consume_status(last):
            consume = resolve_consume_status(db, j)
        health = resolve_sync_job_source_health(db, j)
        items.append(_to_summary(j, last, ds_labels, consume, source_health=health))
    return SyncJobListResponse(items=items)


@router.post("/sync-jobs", response_model=SyncJobDetail, status_code=status.HTTP_201_CREATED)
def create_sync_job(
    payload: SyncJobCreate,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> SyncJobDetail:
    job = SyncJob(
        name=payload.name,
        target_table=payload.target_table,
        schedule_cron=payload.schedule_cron,
        enabled=payload.enabled,
        source_type="mysql",
        source_host="",
        source_port=0,
        source_database="",
        source_username="",
        source_password_encrypted="",
        source_table="",
    )
    _apply_sync_mode_fields(job, payload)
    try:
        resolve_and_apply_source(
            db,
            job,
            source_mode=payload.source_mode,
            source_table=_resolve_source_table(payload),
            source_data_source_id=payload.source_data_source_id,
            inline_source=payload.source,
            source_schema=payload.source_schema,
        )
    except SourceResolverError as exc:
        raise http_exception_from_resolver(exc) from exc
    try:
        assert_unique_target_table(db, payload.target_table)
    except TargetTableConflictError as exc:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "SYNC_TARGET_TABLE_CONFLICT",
                "message": str(exc),
                "detail": {"targetTable": exc.target_table, "jobNames": exc.job_names},
            },
        ) from exc
    db.add(job)
    db.flush()
    default_rules = resolve_initial_etl_rules(db, job, actor)
    db.add(EtlRuleSet(job_id=job.id, rules=default_rules))
    db.commit()
    db.refresh(job)
    refresh_all_jobs()
    return _detail_for_job(db, job)


@router.get("/sync-jobs/{job_id}", response_model=SyncJobDetail)
def get_sync_job(
    job_id: uuid.UUID,
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
) -> SyncJobDetail:
    job = db.get(SyncJob, job_id)
    if job is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "任务不存在", "detail": None},
        )
    return _detail_for_job(db, job)


@router.get("/sync-jobs/{job_id}/consume-hints", response_model=SyncJobConsumeHints)
def get_sync_job_consume_hints(
    job_id: uuid.UUID,
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
) -> SyncJobConsumeHints:
    job = db.get(SyncJob, job_id)
    if job is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "任务不存在", "detail": None},
        )
    return _status_to_hints(resolve_consume_status(db, job))


@router.post("/sync-jobs/{job_id}/prepare-consume", response_model=SyncJobConsumePrepareOut)
def post_prepare_consume(
    job_id: uuid.UUID,
    _: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> SyncJobConsumePrepareOut:
    job = db.get(SyncJob, job_id)
    if job is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "任务不存在", "detail": None},
        )
    result = prepare_sync_consume(db)
    if not result.analytics_ready:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "ANALYTICS_DB_NOT_CONFIGURED",
                "message": "托管分析库未配置或不可达",
                "detail": None,
            },
        )
    return SyncJobConsumePrepareOut(
        analytics_datasource_id=result.analytics_datasource_id,
        analytics_ready=result.analytics_ready,
        created=result.created,
    )


@router.post("/sync-jobs/{job_id}/ensure-dataset", response_model=SyncJobEnsureDatasetOut)
def post_ensure_dataset(
    job_id: uuid.UUID,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    _: Annotated[UserContext, Depends(require_permission(PERM_DATASET_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> SyncJobEnsureDatasetOut:
    job = db.get(SyncJob, job_id)
    if job is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "任务不存在", "detail": None},
        )
    try:
        result = ensure_dataset_for_sync_job(db, job, actor)
    except SyncConsumeError as exc:
        raise HTTPException(
            status_code=exc.status,
            detail={"code": exc.code, "message": exc.message, "detail": None},
        ) from exc
    return SyncJobEnsureDatasetOut(
        dataset_id=result.dataset_id,
        bound_config_id=result.bound_config_id,
        created=result.created,
        bound=result.bound,
    )


@router.post("/sync-jobs/{job_id}/refresh-dataset-binding", response_model=SyncJobRefreshDatasetOut)
def post_refresh_dataset_binding(
    job_id: uuid.UUID,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    _: Annotated[UserContext, Depends(require_permission(PERM_DATASET_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> SyncJobRefreshDatasetOut:
    job = db.get(SyncJob, job_id)
    if job is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "任务不存在", "detail": None},
        )
    try:
        result = refresh_dataset_binding_for_sync_job(db, job, actor)
    except SyncConsumeError as exc:
        raise HTTPException(
            status_code=exc.status,
            detail={"code": exc.code, "message": exc.message, "detail": None},
        ) from exc
    return SyncJobRefreshDatasetOut(
        dataset_id=result.dataset_id,
        bound_config_id=result.bound_config_id,
        display_name=result.display_name,
        columns=result.columns,
        refreshed=result.refreshed,
    )


@router.put("/sync-jobs/{job_id}", response_model=SyncJobDetail)
def update_sync_job(
    job_id: uuid.UUID,
    payload: SyncJobUpdate,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> SyncJobDetail:
    job = db.get(SyncJob, job_id)
    if job is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "任务不存在", "detail": None},
        )
    prev_source_id = job.source_data_source_id
    prev_source_table = job.source_table
    prev_source_schema = job.source_schema
    job.name = payload.name
    job.target_table = payload.target_table
    job.schedule_cron = payload.schedule_cron
    job.enabled = payload.enabled
    _apply_sync_mode_fields(job, payload)
    try:
        resolve_and_apply_source(
            db,
            job,
            source_mode=payload.source_mode,
            source_table=_resolve_source_table(payload),
            source_data_source_id=payload.source_data_source_id,
            inline_source=payload.source,
            source_schema=payload.source_schema,
            preserve_password=True,
        )
    except SourceResolverError as exc:
        raise http_exception_from_resolver(exc) from exc
    try:
        assert_unique_target_table(db, payload.target_table, exclude_job_id=job_id)
    except TargetTableConflictError as exc:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "SYNC_TARGET_TABLE_CONFLICT",
                "message": str(exc),
                "detail": {"targetTable": exc.target_table, "jobNames": exc.job_names},
            },
        ) from exc
    source_changed = (
        prev_source_id != job.source_data_source_id
        or prev_source_table != job.source_table
        or prev_source_schema != job.source_schema
    )
    if source_changed:
        rules_row = db.scalar(select(EtlRuleSet).where(EtlRuleSet.job_id == job_id))
        if rules_row is not None and not rules_row.rules:
            rules_row.rules = resolve_initial_etl_rules(db, job, actor)
    db.commit()
    db.refresh(job)
    refresh_all_jobs()
    return _detail_for_job(db, job)


@router.delete("/sync-jobs/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sync_job(
    job_id: uuid.UUID,
    _: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> None:
    job = db.get(SyncJob, job_id)
    if job is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "任务不存在", "detail": None},
        )
    if find_active_run(db, job_id) is not None:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "SYNC_JOB_RUN_IN_PROGRESS",
                "message": "任务正在运行中，请等待结束后再删除",
                "detail": None,
            },
        )
    delete_datasets_for_sync_job(db, job)
    from app.ingestion.sync_write import drop_analytics_table

    if not drop_analytics_table(job.target_table):
        raise HTTPException(
            status_code=503,
            detail={
                "code": "SYNC_ANALYTICS_TABLE_DROP_FAILED",
                "message": "分析库物理表删除失败，任务元数据未删除。请检查分析库连通性后重试。",
                "detail": {"targetTable": job.target_table},
            },
        )
    db.delete(job)
    db.commit()
    refresh_all_jobs()


@router.get("/sync-jobs/{job_id}/etl-rules", response_model=EtlRulesResponse)
def get_etl_rules(
    job_id: uuid.UUID,
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
) -> EtlRulesResponse:
    rules = db.scalar(select(EtlRuleSet).where(EtlRuleSet.job_id == job_id))
    if rules is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "任务不存在", "detail": None},
        )
    return EtlRulesResponse(rules=rules.rules)


@router.post("/sync-jobs/{job_id}/etl-rules/auto-align", response_model=EtlRulesResponse)
def auto_align_etl_rules(
    job_id: uuid.UUID,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> EtlRulesResponse:
    job = db.get(SyncJob, job_id)
    if job is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "任务不存在", "detail": None},
        )
    rules_row = db.scalar(select(EtlRuleSet).where(EtlRuleSet.job_id == job_id))
    if rules_row is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "任务不存在", "detail": None},
        )
    aligned = resolve_initial_etl_rules(db, job, actor)
    rules_row.rules = aligned
    db.commit()
    return EtlRulesResponse(rules=aligned)


@router.put("/sync-jobs/{job_id}/etl-rules", response_model=EtlRulesResponse)
def put_etl_rules(
    job_id: uuid.UUID,
    payload: EtlRulesPayload,
    _: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> EtlRulesResponse:
    rules = db.scalar(select(EtlRuleSet).where(EtlRuleSet.job_id == job_id))
    if rules is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "任务不存在", "detail": None},
        )
    rules.rules = payload.rules
    db.commit()
    return EtlRulesResponse(rules=rules.rules)


@router.post("/sync-jobs/{job_id}/run", response_model=RunAccepted, status_code=202)
def trigger_run(
    job_id: uuid.UUID,
    request: Request,
    background_tasks: BackgroundTasks,
    _: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> RunAccepted:
    if not get_settings().analytics_database_url:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "ANALYTICS_DB_NOT_CONFIGURED",
                "message": "托管分析库未配置",
                "detail": None,
            },
        )
    job = db.scalar(select(SyncJob).where(SyncJob.id == job_id).with_for_update())
    if job is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "任务不存在", "detail": None},
        )
    if find_active_run(db, job_id) is not None:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "RUN_ALREADY_IN_PROGRESS",
                "message": "该任务正在运行中",
                "detail": None,
            },
        )
    if resolve_sync_job_source_health(db, job) == "missing":
        raise HTTPException(
            status_code=409,
            detail={
                "code": "SYNC_SOURCE_UNAVAILABLE",
                "message": "任务引用的数据连接已删除或不可见，无法运行同步",
                "detail": None,
            },
        )
    try:
        assert_target_table_not_busy(db, job.target_table, exclude_job_id=job_id)
    except TargetTableBusyError as exc:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "SYNC_TARGET_TABLE_BUSY",
                "message": str(exc),
                "detail": {"targetTable": exc.target_table, "jobNames": exc.job_names},
            },
        ) from exc
    trace_id = request.headers.get("X-Trace-Id", str(uuid.uuid4()))
    run = SyncRun(job_id=job_id, status="running", trace_id=trace_id)
    db.add(run)
    db.commit()
    db.refresh(run)
    background_tasks.add_task(run_job, job_id, trace_id, run_id=run.id)
    return RunAccepted(run_id=run.id, status="running")


@router.post("/sync-jobs/{job_id}/cancel", response_model=RunAccepted)
def cancel_run(
    job_id: uuid.UUID,
    _: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> RunAccepted:
    job = db.get(SyncJob, job_id)
    if job is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "任务不存在", "detail": None},
        )
    active = find_active_run(db, job_id)
    if active is None:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "RUN_NOT_IN_PROGRESS",
                "message": "当前没有正在运行的同步可停止",
                "detail": None,
            },
        )
    updated = request_cancel_run(db, active)
    return RunAccepted(run_id=updated.id, status=updated.status)


@router.get("/sync-jobs/{job_id}/runs", response_model=SyncRunListResponse)
def list_runs(
    job_id: uuid.UUID,
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
    limit: int = 20,
) -> SyncRunListResponse:
    if db.get(SyncJob, job_id) is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "任务不存在", "detail": None},
        )
    runs = db.scalars(
        select(SyncRun).where(SyncRun.job_id == job_id).order_by(SyncRun.started_at.desc()).limit(limit)
    ).all()
    return SyncRunListResponse(
        items=[
            SyncRunItem(
                id=r.id,
                status=r.status,
                started_at=r.started_at.isoformat(),
                finished_at=r.finished_at.isoformat() if r.finished_at else None,
                rows_synced=r.rows_synced,
                rows_truncated=bool(getattr(r, "rows_truncated", False)),
                consume_warning=getattr(r, "consume_warning", None),
                error_message=r.error_message,
                trace_id=r.trace_id,
                retry_count=r.retry_count,
            )
            for r in runs
        ]
    )
