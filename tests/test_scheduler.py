import os
import uuid
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import text

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///file:scheduler_test?mode=memory&cache=shared&uri=true"

from apscheduler.triggers.cron import CronTrigger

from app.core.config import get_settings
from app.ingestion.models import Base, SyncJob, encrypt_password, get_meta_engine, get_meta_session
from app.ingestion.scheduler import refresh_all_jobs

get_settings.cache_clear()
get_meta_engine.cache_clear()


@pytest.fixture(scope="module", autouse=True)
def ensure_tables():
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    yield
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM ingestion_sync_jobs"))


def _seed_scheduler_jobs() -> tuple[uuid.UUID, uuid.UUID]:
    db = get_meta_session()
    with_cron = SyncJob(
        name="cron-job",
        source_type="mysql",
        source_host="127.0.0.1",
        source_port=3307,
        source_database="db",
        source_username="u",
        source_password_encrypted=encrypt_password("p"),
        source_table="t",
        target_table="tgt_cron",
        schedule_cron="0 2 * * *",
        enabled=True,
    )
    no_cron = SyncJob(
        name="manual-job",
        source_type="mysql",
        source_host="127.0.0.1",
        source_port=3307,
        source_database="db",
        source_username="u",
        source_password_encrypted=encrypt_password("p"),
        source_table="t",
        target_table="tgt_manual",
        schedule_cron=None,
        enabled=True,
    )
    disabled = SyncJob(
        name="disabled-job",
        source_type="mysql",
        source_host="127.0.0.1",
        source_port=3307,
        source_database="db",
        source_username="u",
        source_password_encrypted=encrypt_password("p"),
        source_table="t",
        target_table="tgt_off",
        schedule_cron="0 3 * * *",
        enabled=False,
    )
    db.add_all([with_cron, no_cron, disabled])
    db.commit()
    ids = (with_cron.id, no_cron.id)
    db.close()
    return ids


@patch("app.ingestion.scheduler.get_scheduler")
def test_refresh_all_jobs_registers_only_enabled_cron(mock_get_scheduler):
    """T-D02-08: enabled+cron 注册 add_job；无 cron / disabled 跳过。"""
    cron_id, manual_id = _seed_scheduler_jobs()
    mock_scheduler = MagicMock()
    mock_scheduler.get_jobs.return_value = []
    mock_get_scheduler.return_value = mock_scheduler

    refresh_all_jobs()

    mock_scheduler.remove_job.assert_not_called()
    assert mock_scheduler.add_job.call_count == 1
    call_kwargs = mock_scheduler.add_job.call_args.kwargs
    assert call_kwargs["id"] == str(cron_id)
    assert call_kwargs["kwargs"]["job_id"] == cron_id
    registered_ids = {c.kwargs["id"] for c in mock_scheduler.add_job.call_args_list}
    assert str(manual_id) not in registered_ids


@patch("app.ingestion.scheduler.run_job")
@patch("app.ingestion.scheduler.get_scheduler")
def test_scheduler_cron_callback_invokes_run_job(mock_get_scheduler, mock_run_job):
    """T-D02-12: add_job func 手动 invoke → run_job 被调用 1 次。"""
    engine = get_meta_engine()
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM ingestion_sync_jobs"))
    cron_id, _ = _seed_scheduler_jobs()
    mock_scheduler = MagicMock()
    mock_scheduler.get_jobs.return_value = []
    mock_get_scheduler.return_value = mock_scheduler

    refresh_all_jobs()

    assert mock_scheduler.add_job.call_count == 1
    registered_func = mock_scheduler.add_job.call_args.args[0]
    kwargs = mock_scheduler.add_job.call_args.kwargs["kwargs"]
    assert kwargs["job_id"] == cron_id
    registered_func(**kwargs)
    mock_run_job.assert_called_once_with(job_id=cron_id, trace_id=kwargs["trace_id"])


@patch("app.ingestion.scheduler.get_scheduler")
def test_refresh_all_jobs_removes_stale_registered_jobs(mock_get_scheduler):
    """T-D02-15: refresh_all_jobs 移除 scheduler 中陈旧 job。"""
    stale_id = "00000000-0000-0000-0000-000000000000"
    mock_scheduler = MagicMock()
    stale_job = MagicMock()
    stale_job.id = stale_id
    mock_scheduler.get_jobs.return_value = [stale_job]
    mock_get_scheduler.return_value = mock_scheduler

    refresh_all_jobs()

    mock_scheduler.remove_job.assert_called_with(stale_id)


@patch("app.ingestion.scheduler.get_scheduler")
def test_refresh_all_jobs_reregisters_on_cron_change(mock_get_scheduler):
    """T-D02-18: schedule_cron 变更后 refresh 以新 CronTrigger 重注册且 replace_existing=True。"""
    engine = get_meta_engine()
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM ingestion_sync_jobs"))
    cron_id, _ = _seed_scheduler_jobs()
    mock_scheduler = MagicMock()
    mock_scheduler.get_jobs.return_value = []
    mock_get_scheduler.return_value = mock_scheduler

    refresh_all_jobs()
    assert mock_scheduler.add_job.call_count == 1
    first_kwargs = mock_scheduler.add_job.call_args.kwargs
    assert first_kwargs["replace_existing"] is True
    assert isinstance(first_kwargs["trigger"], CronTrigger)

    db = get_meta_session()
    job = db.get(SyncJob, cron_id)
    assert job is not None
    job.schedule_cron = "0 4 * * *"
    db.commit()
    db.close()

    registered = MagicMock()
    registered.id = str(cron_id)
    mock_scheduler.reset_mock()
    mock_scheduler.get_jobs.return_value = [registered]

    refresh_all_jobs()

    mock_scheduler.remove_job.assert_called_with(str(cron_id))
    assert mock_scheduler.add_job.call_count == 1
    second_kwargs = mock_scheduler.add_job.call_args.kwargs
    assert second_kwargs["replace_existing"] is True
    assert isinstance(second_kwargs["trigger"], CronTrigger)
    assert second_kwargs["id"] == str(cron_id)


@patch("app.ingestion.scheduler.get_scheduler")
def test_refresh_all_jobs_survives_three_cron_changes(mock_get_scheduler):
    """T-D02-22: 连续 3 次 cron 变更 refresh → remove/add 无未捕获异常。"""
    engine = get_meta_engine()
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM ingestion_sync_jobs"))
    cron_id, _ = _seed_scheduler_jobs()
    mock_scheduler = MagicMock()
    mock_get_scheduler.return_value = mock_scheduler

    cron_exprs = ["0 2 * * *", "0 3 * * *", "0 4 * * *"]
    for expr in cron_exprs:
        db = get_meta_session()
        job = db.get(SyncJob, cron_id)
        assert job is not None
        job.schedule_cron = expr
        db.commit()
        db.close()

        registered = MagicMock()
        registered.id = str(cron_id)
        mock_scheduler.reset_mock()
        mock_scheduler.get_jobs.return_value = [registered]

        refresh_all_jobs()

        mock_scheduler.remove_job.assert_called_with(str(cron_id))
        assert mock_scheduler.add_job.call_count == 1
        assert mock_scheduler.add_job.call_args.kwargs["replace_existing"] is True


@patch("app.ingestion.scheduler.get_scheduler")
def test_refresh_all_jobs_invalid_cron_does_not_crash(mock_get_scheduler):
    """T-D02-26: schedule_cron='not-a-cron' refresh 不抛异常；scheduler 无该 job。"""
    engine = get_meta_engine()
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM ingestion_sync_jobs"))
    db = get_meta_session()
    bad = SyncJob(
        name="bad-cron-job",
        source_type="mysql",
        source_host="127.0.0.1",
        source_port=3307,
        source_database="db",
        source_username="u",
        source_password_encrypted=encrypt_password("p"),
        source_table="t",
        target_table="tgt_bad_cron",
        schedule_cron="not-a-cron",
        enabled=True,
    )
    db.add(bad)
    db.commit()
    bad_id = bad.id
    db.close()

    mock_scheduler = MagicMock()
    mock_scheduler.get_jobs.return_value = []
    mock_get_scheduler.return_value = mock_scheduler

    refresh_all_jobs()

    registered_ids = {c.kwargs.get("id") for c in mock_scheduler.add_job.call_args_list}
    assert str(bad_id) not in registered_ids
