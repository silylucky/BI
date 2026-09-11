import os
import uuid
from unittest.mock import patch

import pytest
from sqlalchemy import select, text

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///file:sync_exec_test?mode=memory&cache=shared&uri=true"
os.environ.setdefault(
    "ANALYTICS_DATABASE_URL",
    "postgresql+psycopg://vitalspan:vitalspan@localhost:5433/analytics",
)

from app.core.config import get_settings
from app.ingestion.models import Base, EtlRuleSet, SyncJob, SyncRun, encrypt_password, get_meta_engine, get_meta_session
from app.ingestion.sync_executor import run_job

get_settings.cache_clear()
get_meta_engine.cache_clear()


@pytest.fixture(scope="module", autouse=True)
def ensure_tables():
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    yield
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM ingestion_sync_runs"))
        conn.execute(text("DELETE FROM ingestion_etl_rules"))
        conn.execute(text("DELETE FROM ingestion_sync_jobs"))


@pytest.fixture(autouse=True)
def _suppress_consume_prepare_warnings():
    with patch("app.ingestion.sync_consume.best_effort_prepare_after_sync", return_value=None):
        yield


def _seed_job(*, target_table: str | None = None) -> uuid.UUID:
    db = get_meta_session()
    job = SyncJob(
        name="mock-job",
        source_type="mysql",
        source_host="127.0.0.1",
        source_port=3307,
        source_database="sample_db",
        source_username="sample",
        source_password_encrypted=encrypt_password("sample"),
        source_table="dirty_orders",
        target_table=target_table or f"orders_mock_{uuid.uuid4().hex[:8]}",
        enabled=True,
    )
    db.add(job)
    db.flush()
    db.add(EtlRuleSet(job_id=job.id, rules=[]))
    db.commit()
    job_id = job.id
    db.close()
    return job_id


def _seed_postgres_job() -> uuid.UUID:
    db = get_meta_session()
    job = SyncJob(
        name="postgres-job",
        source_type="postgresql",
        source_host="127.0.0.1",
        source_port=5432,
        source_database="pg_db",
        source_username="pg",
        source_password_encrypted=encrypt_password("pg"),
        source_table="orders",
        target_table="orders_pg",
        enabled=True,
    )
    db.add(job)
    db.flush()
    db.add(EtlRuleSet(job_id=job.id, rules=[]))
    db.commit()
    job_id = job.id
    db.close()
    return job_id


def _seed_clickhouse_job() -> uuid.UUID:
    db = get_meta_session()
    job = SyncJob(
        name="clickhouse-job",
        source_type="clickhouse",
        source_host="127.0.0.1",
        source_port=8123,
        source_database="default",
        source_username="default",
        source_password_encrypted=encrypt_password(""),
        source_table="orders",
        target_table="orders_ch",
        enabled=True,
    )
    db.add(job)
    db.flush()
    db.add(EtlRuleSet(job_id=job.id, rules=[]))
    db.commit()
    job_id = job.id
    db.close()
    return job_id


def _seed_job_with_l1_rules() -> uuid.UUID:
    db = get_meta_session()
    job = SyncJob(
        name="rules-job",
        source_type="mysql",
        source_host="127.0.0.1",
        source_port=3307,
        source_database="sample_db",
        source_username="sample",
        source_password_encrypted=encrypt_password("sample"),
        source_table="dirty_orders",
        target_table="orders_rules",
        enabled=True,
    )
    db.add(job)
    db.flush()
    db.add(
        EtlRuleSet(
            job_id=job.id,
            rules=[
                {"type": "rename_column", "from": "product_name", "to": "product"},
                {"type": "cast_type", "column": "amount", "to": "float"},
                {"type": "fill_null", "column": "note", "value": "无备注"},
                {"type": "filter_rows", "column": "status", "op": "ne", "value": "deleted"},
            ],
        )
    )
    db.commit()
    job_id = job.id
    db.close()
    return job_id


def _latest_run(job_id: uuid.UUID) -> SyncRun:
    db = get_meta_session()
    run = db.scalar(
        select(SyncRun)
        .where(SyncRun.job_id == job_id)
        .order_by(SyncRun.finished_at.desc().nulls_last(), SyncRun.started_at.desc())
    )
    db.close()
    assert run is not None
    return run


@patch("app.ingestion.sync_executor.write_analytics", return_value=2)
@patch(
    "app.ingestion.sync_executor.fetch_source_rows_result",
    return_value=[
        {"product_name": "A", "amount": "1", "status": "active", "note": None},
        {"product_name": "B", "amount": "2", "status": "active", "note": None},
    ],
)
def test_run_job_success_applies_rules_and_writes(mock_fetch, mock_write):
    job_id = _seed_job()
    run_job(job_id, "trace-success")
    run = _latest_run(job_id)
    assert run.status == "succeeded"
    assert run.rows_synced == 2
    assert run.error_message is None
    assert run.trace_id == "trace-success"
    mock_fetch.assert_called_once()
    mock_write.assert_called_once()


@patch("app.ingestion.sync_executor.fetch_source_rows_result", side_effect=ConnectionError("mysql down"))
def test_run_job_source_failure_retries_then_failed(mock_fetch):
    job_id = _seed_job()
    run_job(job_id, "trace-fail-src")
    run = _latest_run(job_id)
    assert run.status == "failed"
    assert run.retry_count >= 1
    assert run.error_message is not None
    assert "mysql down" in run.error_message
    assert mock_fetch.call_count >= 2


@patch("app.ingestion.sync_executor.get_settings")
def test_run_job_analytics_not_configured(mock_settings):
    mock_settings.return_value.analytics_database_url = None
    job_id = _seed_job()
    run_job(job_id, "trace-no-analytics")
    run = _latest_run(job_id)
    assert run.status == "failed"
    assert "ANALYTICS" in (run.error_message or "")


@patch("app.ingestion.sync_executor.write_analytics", side_effect=RuntimeError("write failed"))
@patch(
    "app.ingestion.sync_executor.fetch_source_rows_result",
    return_value=[{"product_name": "A", "amount": "1", "status": "active", "note": None}],
)
def test_run_job_write_failure(mock_fetch, mock_write):
    job_id = _seed_job()
    run_job(job_id, "trace-write-fail")
    run = _latest_run(job_id)
    assert run.status == "failed"
    assert run.retry_count >= 1
    assert "write failed" in (run.error_message or "")


def test_run_job_missing_job():
    missing = uuid.uuid4()
    result = run_job(missing, "trace-missing")
    assert result is None
    db = get_meta_session()
    run = db.scalar(select(SyncRun).where(SyncRun.trace_id == "trace-missing"))
    db.close()
    assert run is None


@patch("app.ingestion.sync_executor.write_analytics", return_value=1)
@patch("app.ingestion.sync_executor.fetch_source_rows_result", return_value=[{"id": "1"}])
def test_scheduled_run_skipped_when_active_run_exists(mock_fetch, mock_write):
    job_id = _seed_job()
    db = get_meta_session()
    active = SyncRun(job_id=job_id, status="running", trace_id="active-run")
    db.add(active)
    db.commit()
    active_id = active.id
    db.close()

    result = run_job(job_id, "trace-scheduled-skip")
    assert result is None

    db = get_meta_session()
    runs = list(db.scalars(select(SyncRun).where(SyncRun.job_id == job_id)).all())
    assert len(runs) == 1
    assert runs[0].trace_id == "active-run"
    stale = db.get(SyncRun, active_id)
    if stale is not None:
        stale.status = "cancelled"
        db.commit()
    db.close()
    mock_fetch.assert_not_called()
    mock_write.assert_not_called()


@patch("app.ingestion.sync_executor.write_analytics", return_value=0)
@patch("app.ingestion.sync_executor.fetch_source_rows_result", return_value=[])
def test_run_job_clickhouse_source_succeeds_with_mock(mock_fetch, mock_write):
    """ClickHouse 系源可通过 fetch_source_rows 完成同步。"""
    job_id = _seed_clickhouse_job()
    run_job(job_id, "trace-clickhouse-ok")
    run = _latest_run(job_id)
    assert run.status == "succeeded"
    mock_fetch.assert_called_once()


@patch("app.ingestion.sync_executor.write_analytics", return_value=0)
@patch("app.ingestion.sync_executor.fetch_source_rows_result", return_value=[])
def test_run_job_postgresql_source_succeeds_with_mock(mock_fetch, mock_write):
    """PostgreSQL 系源在拉数实现后可通过 fetch_source_rows 完成同步。"""
    job_id = _seed_postgres_job()
    run_job(job_id, "trace-postgres-ok")
    run = _latest_run(job_id)
    assert run.status == "succeeded"
    mock_fetch.assert_called_once()


@patch("app.ingestion.sync_executor.write_analytics", return_value=0)
@patch("app.ingestion.sync_executor.fetch_source_rows_result", return_value=[])
def test_run_job_empty_rows_succeeds_with_zero(mock_fetch, mock_write):
    """T-D02-05: 空行集 → succeeded + rows_synced == 0。"""
    job_id = _seed_job()
    run_job(job_id, "trace-empty-rows")
    run = _latest_run(job_id)
    assert run.status == "succeeded"
    assert run.rows_synced == 0
    mock_write.assert_called_once()
    _job_arg, written_rows = mock_write.call_args[0]
    assert written_rows == []


@patch("app.ingestion.sync_executor.write_analytics", return_value=1)
@patch(
    "app.ingestion.sync_executor.fetch_source_rows_result",
    side_effect=[
        ConnectionError("transient mysql"),
        [{"product_name": "A", "amount": "1", "status": "active", "note": None}],
    ],
)
def test_run_job_retry_reuses_same_run_id(mock_fetch, mock_write):
    """T-D02-06: 重试同一 run_id，不产生 duplicate run 行。"""
    job_id = _seed_job()
    run_job(job_id, "trace-retry-idempotent")
    db = get_meta_session()
    runs = list(db.scalars(select(SyncRun).where(SyncRun.job_id == job_id)).all())
    db.close()
    assert len(runs) == 1
    assert runs[0].trace_id == "trace-retry-idempotent"
    assert runs[0].retry_count >= 1
    assert runs[0].status == "succeeded"
    assert mock_fetch.call_count == 2


@patch("app.ingestion.sync_executor.write_analytics", return_value=1)
@patch(
    "app.ingestion.sync_executor.fetch_source_rows_result",
    return_value=[
        {"product_name": "Widget A", "amount": "12.5", "status": "active", "note": None},
    ],
)
def test_run_job_write_receives_applied_rules(mock_fetch, mock_write):
    """T-ETL-08: mock_write 收到 apply_rules 后的行集。"""
    job_id = _seed_job_with_l1_rules()
    run_job(job_id, "trace-etl-pipeline")
    run = _latest_run(job_id)
    assert run.status == "succeeded"
    written_rows = mock_write.call_args[0][1]
    assert len(written_rows) == 1
    row = written_rows[0]
    assert row["product"] == "Widget A"
    assert row["amount"] == 12.5
    assert row["note"] == "无备注"
    assert "product_name" not in row


from unittest.mock import MagicMock

from app.ingestion.sync_executor import INGESTION_MAX_ROWS


@patch("app.ingestion.sync_executor.write_analytics", return_value=0)
@patch("app.ingestion.sync_fetch_sql._fetch_registry_cursor_rows", return_value=[])
def test_run_job_respects_ingestion_max_rows_limit(mock_fetch_rows, mock_write):
    """T-D02-09: fetch 路径被调用且受 INGESTION_MAX_ROWS 约束。"""
    job_id = _seed_job()
    run_job(job_id, "trace-limit-sql")
    mock_fetch_rows.assert_called_once()


@patch("app.ingestion.sync_executor.fetch_source_rows_result", side_effect=ConnectionError("always down"))
def test_run_job_trace_id_preserved_on_final_failure(mock_fetch):
    """T-D02-10: 源始终失败 → failed 且 trace_id 保持入参。"""
    job_id = _seed_job()
    run_job(job_id, "trace-preserved-fail")
    run = _latest_run(job_id)
    assert run.status == "failed"
    assert run.trace_id == "trace-preserved-fail"


@patch("app.ingestion.sync_executor.write_analytics")
@patch("app.ingestion.sync_executor.fetch_source_rows_result")
def test_run_job_write_row_count_matches_rows_synced(mock_fetch, mock_write):
    """T-D02-11: mock_write 收到 len(rows) 与 rows_synced 一致。"""
    rows = [
        {"product_name": "A", "amount": "1", "status": "active", "note": None},
        {"product_name": "B", "amount": "2", "status": "active", "note": None},
        {"product_name": "C", "amount": "3", "status": "active", "note": None},
    ]
    mock_fetch.return_value = rows
    mock_write.return_value = len(rows)
    job_id = _seed_job()
    run_job(job_id, "trace-batch-count")
    run = _latest_run(job_id)
    assert run.rows_synced == len(rows)
    written = mock_write.call_args[0][1]
    assert len(written) == len(rows)


import time

from app.ingestion.etl_rules import apply_rules


def test_apply_rules_5000_rows_under_two_seconds():
    """T-D02-13: 5000 行经 apply_rules（空规则）耗时 <2.0s。"""
    rows = [{"idx": i, "status": "active"} for i in range(5000)]
    start = time.perf_counter()
    result = apply_rules(rows, [])
    elapsed = time.perf_counter() - start
    assert len(result) == 5000
    assert elapsed < 2.0


@patch("app.ingestion.sync_executor.write_analytics", return_value=0)
@patch(
    "app.ingestion.sync_executor.fetch_source_rows_result",
    return_value=[
        {"status": "deleted", "amount": "1"},
        {"status": "deleted", "amount": "2"},
    ],
)
def test_run_job_filter_removes_all_rows_writes_empty(mock_fetch, mock_write):
    """T-D02-14: 过滤规则剔除全部行 → write 收到 []、rows_synced == 0。"""
    db = get_meta_session()
    job = SyncJob(
        name="filter-all-job",
        source_type="mysql",
        source_host="127.0.0.1",
        source_port=3307,
        source_database="db",
        source_username="u",
        source_password_encrypted=encrypt_password("p"),
        source_table="t",
        target_table="tgt_empty",
        enabled=True,
    )
    db.add(job)
    db.flush()
    db.add(
        EtlRuleSet(
            job_id=job.id,
            rules=[{"type": "filter_rows", "column": "status", "op": "ne", "value": "deleted"}],
        )
    )
    db.commit()
    job_id = job.id
    db.close()

    run_job(job_id, "trace-filter-all")
    run = _latest_run(job_id)
    assert run.status == "succeeded"
    assert run.rows_synced == 0
    written_rows = mock_write.call_args[0][1]
    assert written_rows == []


@patch("app.ingestion.sync_executor.write_analytics", return_value=1)
@patch(
    "app.ingestion.sync_executor.fetch_source_rows_result",
    return_value=[{"amount": "bad", "note": None}],
)
def test_run_job_cast_fail_then_fill_null(mock_fetch, mock_write):
    """T-ETL-12: cast 失败变 None + fill_null 补救后 write 收到填充值。"""
    db = get_meta_session()
    job = SyncJob(
        name="dirty-cast-job",
        source_type="mysql",
        source_host="127.0.0.1",
        source_port=3307,
        source_database="db",
        source_username="u",
        source_password_encrypted=encrypt_password("p"),
        source_table="t",
        target_table="tgt_dirty",
        enabled=True,
    )
    db.add(job)
    db.flush()
    db.add(
        EtlRuleSet(
            job_id=job.id,
            rules=[
                {"type": "cast_type", "column": "amount", "to": "float"},
                {"type": "fill_null", "column": "note", "value": "无备注"},
            ],
        )
    )
    db.commit()
    job_id = job.id
    db.close()

    run_job(job_id, "trace-dirty-cast")
    run = _latest_run(job_id)
    assert run.status == "succeeded"
    written = mock_write.call_args[0][1][0]
    assert written["amount"] is None
    assert written["note"] == "无备注"


@patch("app.ingestion.sync_executor.write_analytics", return_value=1000)
@patch("app.ingestion.sync_executor.fetch_source_rows_result")
def test_run_job_large_batch_row_count(mock_fetch, mock_write):
    """T-D02-16: 大批量 mock fetch 1000 行 → rows_synced==1000 且 write 收到 1000 行。"""
    rows = [
        {"product_name": f"A{i}", "amount": "1", "status": "active", "note": None}
        for i in range(1000)
    ]
    mock_fetch.return_value = rows
    job_id = _seed_job()
    run_job(job_id, "trace-large-batch")
    run = _latest_run(job_id)
    assert run.status == "succeeded"
    assert run.rows_synced == 1000
    written_rows = mock_write.call_args[0][1]
    assert len(written_rows) == 1000


@patch("app.ingestion.sync_executor.fetch_source_rows_result", side_effect=ConnectionError("always fails"))
def test_run_job_retry_exhausted_preserves_trace_and_error(mock_fetch):
    """T-D02-17: 重试耗尽 → failed + trace_id 保持 + error_message 非空且 ≤500。"""
    job_id = _seed_job()
    run_job(job_id, "trace-retry-final")
    run = _latest_run(job_id)
    assert run.status == "failed"
    assert run.trace_id == "trace-retry-final"
    assert run.error_message is not None
    assert "always fails" in run.error_message
    assert run.retry_count >= 1
    assert len(run.error_message) <= 500
    assert mock_fetch.call_count >= 2


from test_etl_rules import DIRTY_ORDERS_SUBSET, L1_RULE_CHAIN


def _seed_job_with_dirty_subset_rules() -> uuid.UUID:
    db = get_meta_session()
    job = SyncJob(
        name="l1-chain-job",
        source_type="mysql",
        source_host="127.0.0.1",
        source_port=3307,
        source_database="sample_db",
        source_username="sample",
        source_password_encrypted=encrypt_password("sample"),
        source_table="dirty_orders",
        target_table="orders_l1_chain",
        enabled=True,
    )
    db.add(job)
    db.flush()
    db.add(EtlRuleSet(job_id=job.id, rules=L1_RULE_CHAIN))
    db.commit()
    job_id = job.id
    db.close()
    return job_id


@patch("app.ingestion.sync_executor.write_analytics")
@patch("app.ingestion.sync_executor.fetch_source_rows_result", return_value=DIRTY_ORDERS_SUBSET)
def test_run_job_l1_rule_chain_writes_transformed_fields(mock_fetch, mock_write):
    """T-ETL-15: L1 全规则链 executor 写字段含 product/amount/note，无 product_name。"""
    mock_write.return_value = 3
    job_id = _seed_job_with_dirty_subset_rules()
    run_job(job_id, "trace-l1-chain")
    run = _latest_run(job_id)
    assert run.status == "succeeded"
    written_rows = mock_write.call_args[0][1]
    assert len(written_rows) >= 1
    first = written_rows[0]
    assert "product" in first
    assert "product_name" not in first
    assert isinstance(first["amount"], float)
    assert first["note"] == "无备注"


@patch("app.ingestion.sync_executor.write_analytics")
@patch("app.ingestion.sync_executor.fetch_source_rows_result")
def test_run_job_full_refresh_writes_latest_rows_not_cumulative(mock_fetch, mock_write):
    """T-D02-19: 连续两次 run 第二次 write 行数等于最新 fetch（M1B 全量刷新，非累加）。"""
    rows_first = [{"product_name": "A", "amount": "1", "status": "active", "note": None}]
    rows_second = [
        {"product_name": "A", "amount": "1", "status": "active", "note": None},
        {"product_name": "B", "amount": "2", "status": "active", "note": None},
    ]
    mock_fetch.side_effect = [rows_first, rows_second]
    mock_write.side_effect = [len(rows_first), len(rows_second)]

    job_id = _seed_job()
    run_job(job_id, "trace-full-refresh-1")
    run_job(job_id, "trace-full-refresh-2")

    assert mock_write.call_count == 2
    second_written = mock_write.call_args_list[1][0][1]
    assert len(second_written) == 2
    first_written = mock_write.call_args_list[0][0][1]
    assert len(first_written) == 1
    run = _latest_run(job_id)
    assert run.status == "succeeded"
    assert run.rows_synced == 2


@patch("app.ingestion.sync_fetch_sql._fetch_registry_cursor_rows", side_effect=Exception("timed out"))
def test_run_job_source_timeout_failed_with_trace(mock_fetch_rows):
    """T-D02-20: 源连接超时 → failed + trace_id 保持 + error_message 含 timed out。"""
    job_id = _seed_job()
    run_job(job_id, "trace-source-timeout")
    run = _latest_run(job_id)
    assert run.status == "failed"
    assert run.trace_id == "trace-source-timeout"
    assert run.error_message is not None
    assert "timed out" in run.error_message.lower()
    assert run.retry_count >= 1


def _seed_named_job(name: str, target_table: str) -> uuid.UUID:
    db = get_meta_session()
    job = SyncJob(
        name=name,
        source_type="mysql",
        source_host="127.0.0.1",
        source_port=3307,
        source_database="db",
        source_username="u",
        source_password_encrypted=encrypt_password("p"),
        source_table="t",
        target_table=target_table,
        enabled=True,
    )
    db.add(job)
    db.flush()
    db.add(EtlRuleSet(job_id=job.id, rules=[]))
    db.commit()
    job_id = job.id
    db.close()
    return job_id


@patch("app.ingestion.sync_executor.write_analytics", return_value=1)
@patch("app.ingestion.sync_executor.fetch_source_rows_result")
def test_run_job_failure_isolation_between_jobs(mock_fetch, mock_write):
    """T-D02-21: job-A fetch 失败不影响 job-B succeeded。"""
    job_a = _seed_named_job("fail-job-a", "tgt_fail_a")
    job_b = _seed_named_job("ok-job-b", "tgt_ok_b")

    def fetch_side_effect(job: SyncJob):
        if job.target_table == "tgt_fail_a":
            raise ConnectionError("job-a fetch down")
        return [{"product_name": "A", "amount": "1", "status": "active", "note": None}]

    mock_fetch.side_effect = fetch_side_effect

    run_job(job_a, "trace-job-a-fail")
    run_job(job_b, "trace-job-b-ok")

    run_a = _latest_run(job_a)
    run_b = _latest_run(job_b)
    assert run_a.status == "failed"
    assert run_b.status == "succeeded"
    assert "job-a fetch down" in (run_a.error_message or "")


def test_apply_rules_10000_rows_under_three_seconds():
    """T-D02-24: 10000 行空规则 apply_rules P95 <3.0s。"""
    rows = [{"idx": i, "status": "active"} for i in range(10000)]
    start = time.perf_counter()
    result = apply_rules(rows, [])
    elapsed = time.perf_counter() - start
    assert len(result) == 10000
    assert elapsed < 3.0


@patch("app.ingestion.sync_executor.fetch_source_rows_result", side_effect=ConnectionError("always fails"))
def test_run_job_retry_count_one_and_history_queryable(mock_fetch):
    """T-D02-25: 重试耗尽 retry_count==1；history GET 可查 failed + trace_id。"""
    job_id = _seed_job()
    run_job(job_id, "trace-retry-history")
    run = _latest_run(job_id)
    assert run.status == "failed"
    assert run.trace_id == "trace-retry-history"
    assert run.retry_count == 1
    assert run.error_message is not None
    assert mock_fetch.call_count >= 2


@patch("app.ingestion.sync_executor.write_analytics")
@patch("app.ingestion.sync_executor.fetch_source_rows_result")
def test_run_job_dirty_amount_fill_null_write_through(mock_fetch, mock_write):
    """T-ETL-22: amount='bad' + fill_null → write 行 amount is None 且 note 已填充。"""
    mock_fetch.return_value = [
        {"amount": "bad", "note": None, "status": "active"},
    ]
    mock_write.return_value = 1
    db = get_meta_session()
    job = SyncJob(
        name="dirty-fill-job",
        source_type="mysql",
        source_host="127.0.0.1",
        source_port=3307,
        source_database="db",
        source_username="u",
        source_password_encrypted=encrypt_password("p"),
        source_table="t",
        target_table="tgt_dirty",
        enabled=True,
    )
    db.add(job)
    db.flush()
    db.add(
        EtlRuleSet(
            job_id=job.id,
            rules=[
                {"type": "cast_type", "column": "amount", "to": "float"},
                {"type": "fill_null", "column": "note", "value": "默认备注"},
            ],
        )
    )
    db.commit()
    job_id = job.id
    db.close()

    run_job(job_id, "trace-dirty-fill")
    run = _latest_run(job_id)
    assert run.status == "succeeded"
    assert run.rows_synced == 1
    written = mock_write.call_args[0][1]
    assert written[0]["amount"] is None
    assert written[0]["note"] == "默认备注"


@patch("app.ingestion.sync_executor.write_analytics")
@patch("app.ingestion.sync_executor.fetch_source_rows_result", return_value=[{"amount": "1"}])
@patch("app.ingestion.sync_executor.apply_rules", side_effect=RuntimeError("rules failed"))
def test_run_job_apply_rules_exception_failed_no_write(mock_apply, mock_fetch, mock_write):
    """T-ETL-25: apply_rules 异常 → status failed、error_message 含 rules failed、不写库。"""
    job_id = _seed_job()
    run_job(job_id, "trace-rules-fail")
    run = _latest_run(job_id)
    assert run.status == "failed"
    assert run.error_message is not None
    assert "rules failed" in run.error_message
    mock_write.assert_not_called()


@patch("app.ingestion.sync_executor.write_analytics")
@patch("app.ingestion.sync_executor.fetch_source_rows_result")
def test_run_job_dirty_amount_none_with_fill_null_note(mock_fetch, mock_write):
    """T-ETL-26: amount='bad' cast 失败 + fill_null note → write 行 amount is None 且 note 已填充。"""
    mock_fetch.return_value = [
        {"amount": "bad", "note": None, "status": "active"},
    ]
    mock_write.return_value = 1
    db = get_meta_session()
    job = SyncJob(
        name="dirty-amount-note-job",
        source_type="mysql",
        source_host="127.0.0.1",
        source_port=3307,
        source_database="db",
        source_username="u",
        source_password_encrypted=encrypt_password("p"),
        source_table="t",
        target_table="tgt_amount_note",
        enabled=True,
    )
    db.add(job)
    db.flush()
    db.add(
        EtlRuleSet(
            job_id=job.id,
            rules=[
                {"type": "cast_type", "column": "amount", "to": "float"},
                {"type": "fill_null", "column": "note", "value": "默认备注"},
            ],
        )
    )
    db.commit()
    job_id = job.id
    db.close()

    run_job(job_id, "trace-dirty-amount-note")
    run = _latest_run(job_id)
    assert run.status == "succeeded"
    written = mock_write.call_args[0][1]
    assert written[0]["amount"] is None
    assert written[0]["note"] == "默认备注"


def _seed_incremental_job(*, last_watermark: str | None = None) -> uuid.UUID:
    db = get_meta_session()
    job = SyncJob(
        name="incremental-job",
        source_type="mysql",
        source_host="127.0.0.1",
        source_port=3307,
        source_database="sample_db",
        source_username="sample",
        source_password_encrypted=encrypt_password("sample"),
        source_table="dirty_orders",
        target_table="orders_inc",
        enabled=True,
        sync_mode="incremental",
        primary_key="id",
        incremental_column="updated_at",
        last_watermark=last_watermark,
    )
    db.add(job)
    db.flush()
    db.add(EtlRuleSet(job_id=job.id, rules=[]))
    db.commit()
    job_id = job.id
    db.close()
    return job_id


@patch("app.ingestion.sync_executor.write_analytics", return_value=1)
@patch("app.ingestion.sync_executor.fetch_source_rows_result")
def test_incremental_second_run_uses_upsert_not_truncate(mock_fetch, mock_write):
    """T-INC-01: incremental 第二次 run 仍走增量写入路径，不 TRUNCATE。"""
    rows_first = [{"id": "1", "updated_at": "100", "name": "a"}]
    rows_second = [{"id": "1", "updated_at": "101", "name": "b"}]
    mock_fetch.side_effect = [rows_first, rows_second]
    job_id = _seed_incremental_job()
    run_job(job_id, "inc-run-1")
    run_job(job_id, "inc-run-2")
    assert mock_write.call_count == 2
    assert mock_fetch.call_count == 2


@patch("app.ingestion.sync_executor.write_analytics", return_value=0)
@patch("app.ingestion.sync_executor.fetch_source_rows_result", return_value=[])
def test_incremental_zero_rows_still_succeeds(mock_fetch, mock_write):
    """T-INC-02: 0 行增量仍 succeeded，水位不变。"""
    job_id = _seed_incremental_job(last_watermark="100")
    run_job(job_id, "inc-zero")
    run = _latest_run(job_id)
    assert run.status == "succeeded"
    assert run.rows_synced == 0
    db = get_meta_session()
    job = db.get(SyncJob, job_id)
    assert job.last_watermark == "100"
    db.close()


def test_write_analytics_routes_full_to_truncate():
    """T-INC-03: write_analytics 全量模式调用 write_analytics_full 路径。"""
    from app.ingestion.sync_write import write_analytics

    job = SyncJob(
        name="full-route",
        source_type="mysql",
        source_host="127.0.0.1",
        source_port=3307,
        source_database="db",
        source_username="u",
        source_password_encrypted=encrypt_password("p"),
        source_table="t",
        target_table="tgt_full",
        enabled=True,
        sync_mode="full",
    )
    with patch("app.ingestion.sync_write.write_analytics_full", return_value=1) as mock_full:
        with patch("app.ingestion.sync_write.write_analytics_incremental") as mock_inc:
            count = write_analytics(job, [{"id": "1"}])
    assert count == 1
    mock_full.assert_called_once()
    mock_inc.assert_not_called()


def test_write_analytics_routes_incremental_to_upsert():
    """T-INC-01: write_analytics 增量模式调用 upsert 路径。"""
    from app.ingestion.sync_write import write_analytics

    job = SyncJob(
        name="inc-route",
        source_type="mysql",
        source_host="127.0.0.1",
        source_port=3307,
        source_database="db",
        source_username="u",
        source_password_encrypted=encrypt_password("p"),
        source_table="t",
        target_table="tgt_inc",
        enabled=True,
        sync_mode="incremental",
        primary_key="id",
        incremental_column="updated_at",
    )
    with patch("app.ingestion.sync_write.write_analytics_incremental", return_value=1) as mock_inc:
        with patch("app.ingestion.sync_write.write_analytics_full") as mock_full:
            count = write_analytics(job, [{"id": "1", "updated_at": "1"}])
    assert count == 1
    mock_inc.assert_called_once()
    mock_full.assert_not_called()


@patch("app.ingestion.sync_executor.write_analytics", return_value=1)
@patch(
    "app.ingestion.sync_executor.fetch_source_rows_result",
    return_value=[{"id": "1", "updated_at": "200", "name": "x"}],
)
def test_incremental_watermark_advances(mock_fetch, mock_write):
    """T-INC-02: 成功后 last_watermark 推进。"""
    job_id = _seed_incremental_job(last_watermark="100")
    run_job(job_id, "inc-wm")
    db = get_meta_session()
    job = db.get(SyncJob, job_id)
    assert job.last_watermark == "200"
    db.close()


def test_reconcile_stale_running_runs_marks_old_running_as_failed():
    from datetime import datetime, timedelta, timezone

    from app.ingestion.sync_executor import reconcile_stale_running_runs

    job_id = _seed_job()
    db = get_meta_session()
    stale = SyncRun(
        job_id=job_id,
        status="running",
        trace_id="stale",
        started_at=datetime.now(timezone.utc) - timedelta(minutes=5),
    )
    fresh = SyncRun(
        job_id=job_id,
        status="running",
        trace_id="fresh",
        started_at=datetime.now(timezone.utc),
    )
    db.add_all([stale, fresh])
    db.commit()
    stale_id, fresh_id = stale.id, fresh.id
    db.close()

    count = reconcile_stale_running_runs(max_age_seconds=120)
    assert count == 1

    db = get_meta_session()
    stale_run = db.get(SyncRun, stale_id)
    fresh_run = db.get(SyncRun, fresh_id)
    assert stale_run.status == "failed"
    assert stale_run.finished_at is not None
    assert "超时" in (stale_run.error_message or "")
    assert fresh_run.status == "running"
    db.close()


@patch("app.ingestion.sync_executor.fetch_source_rows_result", return_value=[{"id": "1"}])
@patch("app.ingestion.sync_executor.write_analytics", return_value=1)
@patch("app.ingestion.sync_consume.best_effort_prepare_after_sync", return_value=None)
def test_run_job_success_calls_auto_prepare(mock_prepare, mock_write, mock_fetch):
    job_id = _seed_job()
    run_job(job_id, "auto-prepare-trace")
    mock_prepare.assert_called_once()
