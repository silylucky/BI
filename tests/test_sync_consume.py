"""sync_consume 域集成：ensure-dataset 不经 endpoint 层 mock。"""
from __future__ import annotations

import os
import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.core.config import get_settings
from app.ingestion.models import Base as IngestionBase, SyncJob, get_meta_engine
from app.ingestion.sync_consume import ensure_dataset_for_sync_job, refresh_dataset_binding_for_sync_job
from app.metadata.dataset.models import DatasetRecord

_SQLITE_URL = "sqlite+pysqlite:///file:sync_consume_test?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def sync_consume_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _SQLITE_URL
    os.environ.setdefault(
        "ANALYTICS_DATABASE_URL",
        "postgresql+psycopg://vitalspan:vitalspan@localhost:5433/analytics",
    )
    get_settings.cache_clear()
    get_meta_engine.cache_clear()

    import app.metadata.dataset.models  # noqa: F401
    import app.query.config_store.models  # noqa: F401
    from app.datasources.models import Base as MetaBase

    engine = get_meta_engine()
    IngestionBase.metadata.create_all(engine)
    MetaBase.metadata.create_all(engine)
    yield
    if previous is None:
        os.environ.pop("DATABASE_URL", None)
    else:
        os.environ["DATABASE_URL"] = previous
    get_settings.cache_clear()
    get_meta_engine.cache_clear()


@pytest.fixture
def db_session() -> Session:
    from app.ingestion.models import get_meta_session

    session = get_meta_session()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def admin_actor() -> UserContext:
    return UserContext(id=str(uuid.uuid4()), username="admin", roles=["admin"])


def test_ensure_dataset_for_sync_job_creates_and_binds(
    db_session: Session,
    admin_actor: UserContext,
) -> None:
    ds_id = uuid.uuid4()
    dataset_id = f"truth_ensure_{uuid.uuid4().hex[:8]}"
    job = SyncJob(
        name="truth-job",
        target_table=dataset_id,
        schedule_cron=None,
        enabled=True,
        source_type="mysql",
        source_host="127.0.0.1",
        source_port=3307,
        source_database="sample_db",
        source_username="sample",
        source_password_encrypted="x",
        source_table="dirty_orders",
    )
    db_session.add(job)
    db_session.commit()

    mock_columns = MagicMock()
    mock_columns.items = [
        SimpleNamespace(name="id"),
        SimpleNamespace(name="amount"),
        SimpleNamespace(name="product_name"),
        SimpleNamespace(name="internal_flag"),
    ]

    with (
        patch(
            "app.ingestion.sync_consume.ensure_analytics_datasource",
            return_value=ds_id,
        ),
        patch(
            "app.ingestion.sync_consume.list_columns",
            return_value=mock_columns,
        ),
    ):
        result = ensure_dataset_for_sync_job(db_session, job, admin_actor)

    assert result.dataset_id == dataset_id
    assert result.bound is True
    assert result.bound_config_id is not None

    row = db_session.get(DatasetRecord, dataset_id)
    assert row is not None
    assert row.bound_config_id == result.bound_config_id
    assert row.display_name == "同步：truth-job"
    assert row.table_source_datasource_id == ds_id

    from app.query.config_store.service import get_config_by_id

    bound = get_config_by_id(db_session, result.bound_config_id)
    payload = bound.payload if isinstance(bound.payload, dict) else {}
    bound_columns = payload.get("columns", [])
    assert "amount" in bound_columns
    assert "product_name" in bound_columns
    assert bound_columns

    db_session.delete(job)
    if row:
        db_session.delete(row)
    db_session.commit()


def test_ensure_dataset_for_sync_job_idempotent_when_bound(
    db_session: Session,
    admin_actor: UserContext,
) -> None:
    ds_id = uuid.uuid4()
    dataset_id = f"truth_bound_{uuid.uuid4().hex[:8]}"
    job = SyncJob(
        name="truth-job-bound",
        target_table=dataset_id,
        schedule_cron=None,
        enabled=True,
        source_type="mysql",
        source_host="127.0.0.1",
        source_port=3307,
        source_database="sample_db",
        source_username="sample",
        source_password_encrypted="x",
        source_table="dirty_orders",
    )
    db_session.add(job)
    db_session.commit()

    mock_columns = MagicMock()
    mock_columns.items = [SimpleNamespace(name="id")]

    with (
        patch(
            "app.ingestion.sync_consume.ensure_analytics_datasource",
            return_value=ds_id,
        ),
        patch(
            "app.ingestion.sync_consume.list_columns",
            return_value=mock_columns,
        ),
    ):
        first = ensure_dataset_for_sync_job(db_session, job, admin_actor)
        second = ensure_dataset_for_sync_job(db_session, job, admin_actor)

    assert first.bound is True
    assert second.bound is False
    assert second.bound_config_id == first.bound_config_id

    row = db_session.get(DatasetRecord, dataset_id)
    db_session.delete(job)
    if row:
        db_session.delete(row)
    db_session.commit()


def test_refresh_dataset_binding_updates_display_and_columns(
    db_session: Session,
    admin_actor: UserContext,
) -> None:
    ds_id = uuid.uuid4()
    dataset_id = f"refresh_{uuid.uuid4().hex[:8]}"
    job = SyncJob(
        name="刷新任务",
        target_table=dataset_id,
        schedule_cron=None,
        enabled=True,
        source_type="mysql",
        source_host="127.0.0.1",
        source_port=3307,
        source_database="sample_db",
        source_username="sample",
        source_password_encrypted="x",
        source_table="dirty_orders",
    )
    db_session.add(job)
    db_session.commit()

    mock_columns = MagicMock()
    mock_columns.items = [
        SimpleNamespace(name="id"),
        SimpleNamespace(name="amount"),
        SimpleNamespace(name="product_name"),
    ]

    with (
        patch(
            "app.ingestion.sync_consume.ensure_analytics_datasource",
            return_value=ds_id,
        ),
        patch(
            "app.ingestion.sync_consume.list_columns",
            return_value=mock_columns,
        ),
    ):
        ensure_dataset_for_sync_job(db_session, job, admin_actor)
        row = db_session.get(DatasetRecord, dataset_id)
        assert row is not None
        row.display_name = dataset_id
        db_session.commit()
        result = refresh_dataset_binding_for_sync_job(db_session, job, admin_actor)

    assert result.display_name == "同步：刷新任务"
    assert result.refreshed is True
    assert "amount" in result.columns

    row = db_session.get(DatasetRecord, dataset_id)
    db_session.delete(job)
    if row:
        db_session.delete(row)
    db_session.commit()


def test_ensure_dataset_different_ids_for_different_target_tables(
    db_session: Session,
    admin_actor: UserContext,
) -> None:
    """两 job 不同 target_table → ensure 后 Dataset ID 分别等于各自 target_table。"""
    ds_id = uuid.uuid4()
    target_a = f"orders_clean_{uuid.uuid4().hex[:6]}"
    target_b = f"orders_clean_{uuid.uuid4().hex[:6]}"
    job_a = SyncJob(
        name="job-a",
        target_table=target_a,
        schedule_cron=None,
        enabled=True,
        source_type="mysql",
        source_host="127.0.0.1",
        source_port=3307,
        source_database="sample_db",
        source_username="sample",
        source_password_encrypted="x",
        source_table="dirty_orders",
    )
    job_b = SyncJob(
        name="job-b",
        target_table=target_b,
        schedule_cron=None,
        enabled=True,
        source_type="mysql",
        source_host="127.0.0.1",
        source_port=3307,
        source_database="sample_db",
        source_username="sample",
        source_password_encrypted="x",
        source_table="dirty_orders",
    )
    db_session.add(job_a)
    db_session.add(job_b)
    db_session.commit()

    mock_columns = MagicMock()
    mock_columns.items = [SimpleNamespace(name="id")]

    with (
        patch(
            "app.ingestion.sync_consume.ensure_analytics_datasource",
            return_value=ds_id,
        ),
        patch(
            "app.ingestion.sync_consume.list_columns",
            return_value=mock_columns,
        ),
    ):
        result_a = ensure_dataset_for_sync_job(db_session, job_a, admin_actor)
        result_b = ensure_dataset_for_sync_job(db_session, job_b, admin_actor)

    assert result_a.dataset_id == target_a
    assert result_b.dataset_id == target_b
    assert result_a.dataset_id != result_b.dataset_id
    row_a = db_session.get(DatasetRecord, target_a)
    row_b = db_session.get(DatasetRecord, target_b)
    assert row_a is not None
    assert row_b is not None

    db_session.delete(job_a)
    db_session.delete(job_b)
    if row_a:
        db_session.delete(row_a)
    if row_b:
        db_session.delete(row_b)
    db_session.commit()
