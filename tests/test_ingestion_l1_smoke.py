import os
import time
import uuid
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///file:l1_smoke?mode=memory&cache=shared&uri=true"

from app.core.config import get_settings
from app.ingestion.models import Base, get_meta_engine
from app.main import app

get_settings.cache_clear()
get_meta_engine.cache_clear()

L1_RULES = [
    {"type": "rename_column", "from": "product_name", "to": "product"},
    {"type": "cast_type", "column": "amount", "to": "float"},
    {"type": "fill_null", "column": "note", "value": "无备注"},
    {"type": "filter_rows", "column": "status", "op": "ne", "value": "deleted"},
]

MOCK_ROWS = [
    {"product_name": "Widget A", "amount": "12.5", "status": "active", "note": None},
    {"product_name": "Widget B", "amount": "2", "status": "active", "note": None},
]


@pytest.fixture(scope="module", autouse=True)
def meta_tables():
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    yield


@pytest.fixture
def smoke_client(monkeypatch) -> TestClient:
    monkeypatch.setenv(
        "ANALYTICS_DATABASE_URL",
        "postgresql+psycopg://vitalspan:vitalspan@localhost:5433/analytics",
    )
    get_settings.cache_clear()
    return TestClient(app)


@patch("app.ingestion.sync_executor.write_analytics", return_value=2)
@patch("app.ingestion.sync_executor.fetch_mysql_rows", return_value=MOCK_ROWS)
def test_l1_mock_smoke_success(mock_fetch, mock_write, smoke_client, auth_headers):
    """T-D05-01 / T-D02-07: mock L1 创建→规则→run→succeeded + traceId/行数。"""
    payload = {
        "name": "l1-mock-smoke",
        "source": {
            "type": "mysql",
            "host": "127.0.0.1",
            "port": 3307,
            "database": "sample_db",
            "username": "sample",
            "password": "sample",
            "table": "dirty_orders",
        },
        "target_table": "orders_mock_l1",
        "schedule_cron": None,
    }
    create = smoke_client.post("/api/v1/ingestion/sync-jobs", json=payload, headers=auth_headers)
    assert create.status_code == 201, create.text
    job_id = create.json()["id"]

    put_rules = smoke_client.put(
        f"/api/v1/ingestion/sync-jobs/{job_id}/etl-rules",
        json={"rules": L1_RULES},
        headers=auth_headers,
    )
    assert put_rules.status_code == 200

    trace_headers = {**auth_headers, "X-Trace-Id": "mock-l1-trace-001"}
    run = smoke_client.post(
        f"/api/v1/ingestion/sync-jobs/{job_id}/run",
        headers=trace_headers,
    )
    assert run.status_code == 202
    run_id = run.json()["run_id"]

    deadline = time.time() + 10
    final = None
    while time.time() < deadline:
        listed = smoke_client.get(
            f"/api/v1/ingestion/sync-jobs/{job_id}/runs",
            headers=auth_headers,
        )
        items = listed.json()["items"]
        match = next((i for i in items if i["id"] == run_id), None)
        if match and match["status"] in ("succeeded", "failed"):
            final = match
            break
        time.sleep(0.1)

    assert final is not None
    assert final["status"] == "succeeded", final
    assert final["trace_id"] == "mock-l1-trace-001"
    assert final["rows_synced"] == 2
    assert final["error_message"] is None
    mock_fetch.assert_called()
    mock_write.assert_called()
    written_rows = mock_write.call_args[0][1]
    assert len(written_rows) == len(MOCK_ROWS)

    smoke_client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)


@patch("app.ingestion.sync_executor.write_analytics", return_value=1)
@patch("app.ingestion.sync_executor.fetch_mysql_rows", return_value=MOCK_ROWS[:1])
def test_l1_mock_smoke_history_list_order(mock_fetch, mock_write, smoke_client, auth_headers):
    """T-D05-03: runs 按 started_at 降序。"""
    payload = {
        "name": "l1-order-smoke",
        "source": {
            "type": "mysql",
            "host": "127.0.0.1",
            "port": 3307,
            "database": "sample_db",
            "username": "sample",
            "password": "sample",
            "table": "dirty_orders",
        },
        "target_table": "orders_order_test",
        "schedule_cron": None,
    }
    create = smoke_client.post("/api/v1/ingestion/sync-jobs", json=payload, headers=auth_headers)
    job_id = create.json()["id"]
    for _ in range(2):
        run_resp = smoke_client.post(
            f"/api/v1/ingestion/sync-jobs/{job_id}/run",
            headers=auth_headers,
        )
        if run_resp.status_code == 409:
            time.sleep(0.2)
            run_resp = smoke_client.post(
                f"/api/v1/ingestion/sync-jobs/{job_id}/run",
                headers=auth_headers,
            )
        assert run_resp.status_code == 202
        deadline = time.time() + 15
        while time.time() < deadline:
            listed = smoke_client.get(
                f"/api/v1/ingestion/sync-jobs/{job_id}/runs",
                headers=auth_headers,
            )
            items = listed.json()["items"]
            latest = items[0] if items else None
            if latest and latest["status"] in ("succeeded", "failed"):
                break
            time.sleep(0.1)
    items = smoke_client.get(
        f"/api/v1/ingestion/sync-jobs/{job_id}/runs",
        headers=auth_headers,
    ).json()["items"]
    assert len(items) >= 2
    starts = [i["started_at"] for i in items]
    assert starts == sorted(starts, reverse=True)
    smoke_client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)


@patch("app.ingestion.sync_executor.fetch_mysql_rows", side_effect=ConnectionError("mock source down"))
def test_l1_mock_smoke_source_failure(mock_fetch, smoke_client, auth_headers):
    """T-D05-02: mock L1 源失败 → failed + errorMessage + traceId。"""
    payload = {
        "name": "l1-mock-fail",
        "source": {
            "type": "mysql",
            "host": "127.0.0.1",
            "port": 3307,
            "database": "sample_db",
            "username": "sample",
            "password": "sample",
            "table": "dirty_orders",
        },
        "target_table": "orders_mock_fail",
        "schedule_cron": None,
    }
    create = smoke_client.post("/api/v1/ingestion/sync-jobs", json=payload, headers=auth_headers)
    job_id = create.json()["id"]
    trace_headers = {**auth_headers, "X-Trace-Id": "mock-l1-fail-trace"}
    run = smoke_client.post(
        f"/api/v1/ingestion/sync-jobs/{job_id}/run",
        headers=trace_headers,
    )
    assert run.status_code == 202
    run_id = run.json()["run_id"]

    deadline = time.time() + 15
    final = None
    while time.time() < deadline:
        listed = smoke_client.get(
            f"/api/v1/ingestion/sync-jobs/{job_id}/runs",
            headers=auth_headers,
        )
        match = next((i for i in listed.json()["items"] if i["id"] == run_id), None)
        if match and match["status"] in ("succeeded", "failed"):
            final = match
            break
        time.sleep(0.1)

    assert final is not None
    assert final["status"] == "failed"
    assert final["trace_id"] == "mock-l1-fail-trace"
    assert final["error_message"] is not None
    assert "mock source down" in final["error_message"]
    assert len(final["error_message"]) <= 500

    smoke_client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)


@patch("app.ingestion.sync_executor.write_analytics", return_value=2)
@patch("app.ingestion.sync_executor.fetch_mysql_rows", return_value=MOCK_ROWS)
def test_l1_mock_smoke_end_to_end_under_three_seconds(
    mock_fetch, mock_write, smoke_client, auth_headers
):
    """T-L1-04: mock L1 全流程 create+rules+run+history 耗时 <3.0s。"""
    payload = {
        "name": "l1-perf-smoke",
        "source": {
            "type": "mysql",
            "host": "127.0.0.1",
            "port": 3307,
            "database": "sample_db",
            "username": "sample",
            "password": "sample",
            "table": "dirty_orders",
        },
        "target_table": "orders_perf_l1",
        "schedule_cron": None,
    }
    start = time.perf_counter()

    create = smoke_client.post("/api/v1/ingestion/sync-jobs", json=payload, headers=auth_headers)
    assert create.status_code == 201
    job_id = create.json()["id"]

    put_rules = smoke_client.put(
        f"/api/v1/ingestion/sync-jobs/{job_id}/etl-rules",
        json={"rules": L1_RULES},
        headers=auth_headers,
    )
    assert put_rules.status_code == 200

    run = smoke_client.post(
        f"/api/v1/ingestion/sync-jobs/{job_id}/run",
        headers=auth_headers,
    )
    assert run.status_code == 202
    run_id = run.json()["run_id"]

    deadline = time.time() + 10
    final = None
    while time.time() < deadline:
        listed = smoke_client.get(
            f"/api/v1/ingestion/sync-jobs/{job_id}/runs",
            headers=auth_headers,
        )
        match = next((i for i in listed.json()["items"] if i["id"] == run_id), None)
        if match and match["status"] in ("succeeded", "failed"):
            final = match
            break
        time.sleep(0.05)

    elapsed = time.perf_counter() - start
    assert final is not None
    assert final["status"] == "succeeded"
    assert elapsed < 3.0

    smoke_client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)


@pytest.fixture
def analytics_smoke_client() -> TestClient:
    return TestClient(app)


L1_SHARED_ANALYTICS = "sqlite+pysqlite:///file:l1_analytics_r11?mode=memory&cache=shared&uri=true"


def _analytics_sqlite_file_url() -> str:
    import tempfile
    from pathlib import Path

    path = Path(tempfile.gettempdir()) / "vitalspan_l1_analytics_r11.db"
    if path.exists():
        path.unlink()
    return f"sqlite+pysqlite:///{path}"


def _sqlite_write_analytics(job, rows):
    """L1 smoke: sqlite-compatible write (DELETE vs TRUNCATE) for analytics_sqlite write-through."""
    from sqlalchemy import create_engine, text
    from sqlalchemy.pool import StaticPool

    from app.ingestion import sync_executor

    settings = sync_executor.get_settings()
    engine = create_engine(
        settings.analytics_database_url,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    if not rows:
        return 0
    columns = list(rows[0].keys())
    col_defs = ", ".join(f'"{c}" TEXT' for c in columns)
    placeholders = ", ".join(f":{c}" for c in columns)
    insert_sql = text(
        f'INSERT INTO "{job.target_table}" ({", ".join(columns)}) VALUES ({placeholders})'
    )
    with engine.begin() as conn:
        conn.execute(text(f'CREATE TABLE IF NOT EXISTS "{job.target_table}" ({col_defs})'))
        conn.execute(text(f'DELETE FROM "{job.target_table}"'))
        for row in rows:
            conn.execute(insert_sql, row)
    return len(rows)


@patch("app.ingestion.sync_executor.write_analytics", side_effect=_sqlite_write_analytics)
@patch("app.api.v1.ingestion.sync.get_settings")
@patch("app.ingestion.sync_executor.get_settings")
@patch("app.ingestion.sync_executor.fetch_mysql_rows", return_value=MOCK_ROWS)
def test_l1_analytics_sqlite_write_through(
    mock_fetch,
    mock_exec_settings,
    mock_api_settings,
    mock_write,
    analytics_smoke_client,
    auth_headers,
    analytics_sqlite,
):
    """T-L1-05: mock fetch + 真实 analytics_sqlite 写穿 → SELECT 目标表行与列。"""
    from unittest.mock import MagicMock
    from sqlalchemy import create_engine
    from sqlalchemy.pool import StaticPool

    shared_url = _analytics_sqlite_file_url()
    mock_settings = MagicMock()
    mock_settings.analytics_database_url = shared_url
    mock_exec_settings.return_value = mock_settings
    mock_api_settings.return_value = mock_settings
    verify_engine = create_engine(
        shared_url,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    target_table = "orders_l1_write"
    payload = {
        "name": "l1-write-through",
        "source": {
            "type": "mysql",
            "host": "127.0.0.1",
            "port": 3307,
            "database": "sample_db",
            "username": "sample",
            "password": "sample",
            "table": "dirty_orders",
        },
        "target_table": target_table,
        "schedule_cron": None,
    }
    create = analytics_smoke_client.post(
        "/api/v1/ingestion/sync-jobs", json=payload, headers=auth_headers
    )
    assert create.status_code == 201
    job_id = create.json()["id"]

    put_rules = analytics_smoke_client.put(
        f"/api/v1/ingestion/sync-jobs/{job_id}/etl-rules",
        json={"rules": L1_RULES},
        headers=auth_headers,
    )
    assert put_rules.status_code == 200

    run = analytics_smoke_client.post(
        f"/api/v1/ingestion/sync-jobs/{job_id}/run",
        headers=auth_headers,
    )
    assert run.status_code == 202
    run_id = run.json()["run_id"]

    deadline = time.time() + 15
    final = None
    while time.time() < deadline:
        listed = analytics_smoke_client.get(
            f"/api/v1/ingestion/sync-jobs/{job_id}/runs",
            headers=auth_headers,
        )
        match = next((i for i in listed.json()["items"] if i["id"] == run_id), None)
        if match and match["status"] in ("succeeded", "failed"):
            final = match
            break
        time.sleep(0.05)

    assert final is not None
    assert final["status"] == "succeeded"

    with verify_engine.connect() as conn:
        rows = conn.execute(text(f'SELECT * FROM "{target_table}"')).mappings().all()
    assert len(rows) >= 1
    assert "product" in rows[0]
    assert "amount" in rows[0]
    assert "note" in rows[0]

    analytics_smoke_client.delete(
        f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers
    )


@patch("app.ingestion.sync_executor.write_analytics", return_value=1)
@patch("app.ingestion.sync_executor.fetch_mysql_rows", return_value=MOCK_ROWS[:1])
def test_l1_runs_started_at_descending(
    mock_fetch, mock_write, smoke_client, auth_headers
):
    """T-L1-06: 连续两次 run 后 GET runs 首项 started_at ≥ 次项。"""
    payload = {
        "name": "l1-order-r11",
        "source": {
            "type": "mysql",
            "host": "127.0.0.1",
            "port": 3307,
            "database": "sample_db",
            "username": "sample",
            "password": "sample",
            "table": "dirty_orders",
        },
        "target_table": "orders_l1_order_r11",
        "schedule_cron": None,
    }
    create = smoke_client.post("/api/v1/ingestion/sync-jobs", json=payload, headers=auth_headers)
    job_id = create.json()["id"]
    for _ in range(2):
        run_resp = smoke_client.post(
            f"/api/v1/ingestion/sync-jobs/{job_id}/run",
            headers=auth_headers,
        )
        if run_resp.status_code == 409:
            time.sleep(0.2)
            run_resp = smoke_client.post(
                f"/api/v1/ingestion/sync-jobs/{job_id}/run",
                headers=auth_headers,
            )
        assert run_resp.status_code == 202
        deadline = time.time() + 15
        while time.time() < deadline:
            listed = smoke_client.get(
                f"/api/v1/ingestion/sync-jobs/{job_id}/runs",
                headers=auth_headers,
            )
            latest = listed.json()["items"][0] if listed.json()["items"] else None
            if latest and latest["status"] in ("succeeded", "failed"):
                break
            time.sleep(0.1)
    items = smoke_client.get(
        f"/api/v1/ingestion/sync-jobs/{job_id}/runs",
        headers=auth_headers,
    ).json()["items"]
    assert len(items) >= 2
    assert items[0]["started_at"] >= items[1]["started_at"]
    smoke_client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)


@patch("app.ingestion.sync_executor.write_analytics", return_value=2)
@patch("app.ingestion.sync_executor.fetch_mysql_rows", return_value=MOCK_ROWS)
def test_l1_data_smoke_orchestrator(mock_fetch, mock_write, smoke_client, auth_headers):
    """T-L1-07: 单测编排 create→rules→run→poll→succeeded + trace + rows + 规则后列名。"""
    payload = {
        "name": "l1-orchestrator-smoke",
        "source": {
            "type": "mysql",
            "host": "127.0.0.1",
            "port": 3307,
            "database": "sample_db",
            "username": "sample",
            "password": "sample",
            "table": "dirty_orders",
        },
        "target_table": "orders_orchestrator",
        "schedule_cron": None,
    }
    create = smoke_client.post("/api/v1/ingestion/sync-jobs", json=payload, headers=auth_headers)
    assert create.status_code == 201, create.text
    job_id = create.json()["id"]

    put_rules = smoke_client.put(
        f"/api/v1/ingestion/sync-jobs/{job_id}/etl-rules",
        json={"rules": L1_RULES},
        headers=auth_headers,
    )
    assert put_rules.status_code == 200

    trace_headers = {**auth_headers, "X-Trace-Id": "l1-orchestrator-trace"}
    run = smoke_client.post(
        f"/api/v1/ingestion/sync-jobs/{job_id}/run",
        headers=trace_headers,
    )
    assert run.status_code == 202
    run_id = run.json()["run_id"]

    deadline = time.time() + 10
    final = None
    while time.time() < deadline:
        listed = smoke_client.get(
            f"/api/v1/ingestion/sync-jobs/{job_id}/runs",
            headers=auth_headers,
        )
        match = next((i for i in listed.json()["items"] if i["id"] == run_id), None)
        if match and match["status"] in ("succeeded", "failed"):
            final = match
            break
        time.sleep(0.05)

    assert final is not None
    assert final["status"] == "succeeded", final
    assert final["trace_id"] == "l1-orchestrator-trace"
    assert final["rows_synced"] == 2
    written_rows = mock_write.call_args[0][1]
    assert len(written_rows) == len(MOCK_ROWS)
    assert "product" in written_rows[0]
    assert "product_name" not in written_rows[0]

    smoke_client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)


@patch("app.ingestion.sync_executor.write_analytics", return_value=2)
@patch("app.ingestion.sync_executor.fetch_mysql_rows", return_value=MOCK_ROWS)
def test_l1_data_smoke_orchestrator_under_2_5_seconds(
    mock_fetch, mock_write, smoke_client, auth_headers
):
    """T-L1-08: L1 编排全流程 mock 预算 <2.5s。"""
    payload = {
        "name": "l1-orchestrator-perf",
        "source": {
            "type": "mysql",
            "host": "127.0.0.1",
            "port": 3307,
            "database": "sample_db",
            "username": "sample",
            "password": "sample",
            "table": "dirty_orders",
        },
        "target_table": "orders_orchestrator_perf",
        "schedule_cron": None,
    }
    start = time.perf_counter()

    create = smoke_client.post("/api/v1/ingestion/sync-jobs", json=payload, headers=auth_headers)
    assert create.status_code == 201
    job_id = create.json()["id"]

    put_rules = smoke_client.put(
        f"/api/v1/ingestion/sync-jobs/{job_id}/etl-rules",
        json={"rules": L1_RULES},
        headers=auth_headers,
    )
    assert put_rules.status_code == 200

    run = smoke_client.post(
        f"/api/v1/ingestion/sync-jobs/{job_id}/run",
        headers=auth_headers,
    )
    assert run.status_code == 202
    run_id = run.json()["run_id"]

    deadline = time.time() + 10
    final = None
    while time.time() < deadline:
        listed = smoke_client.get(
            f"/api/v1/ingestion/sync-jobs/{job_id}/runs",
            headers=auth_headers,
        )
        match = next((i for i in listed.json()["items"] if i["id"] == run_id), None)
        if match and match["status"] in ("succeeded", "failed"):
            final = match
            break
        time.sleep(0.05)

    elapsed = time.perf_counter() - start
    assert final is not None
    assert final["status"] == "succeeded"
    assert elapsed < 2.5

    smoke_client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)


@pytest.mark.integration
def test_l1_compose_mysql_to_analytics_write_through(
    integration_env, smoke_client, auth_headers, monkeypatch
):
    """T-L1-09: compose 可用时样例 mysql→analytics 写穿；不可用 skip。"""
    from app.core.config import get_settings

    monkeypatch.setenv("ANALYTICS_DATABASE_URL", integration_env["analytics_url"])
    get_settings.cache_clear()
    target_table = f"orders_l1_compose_{uuid.uuid4().hex[:8]}"
    payload = {
        "name": "l1-compose-write",
        "source": {
            "type": "mysql",
            "host": "127.0.0.1",
            "port": 3307,
            "database": "sample_db",
            "username": "sample",
            "password": "sample",
            "table": "dirty_orders",
        },
        "target_table": target_table,
        "schedule_cron": None,
    }
    create = smoke_client.post("/api/v1/ingestion/sync-jobs", json=payload, headers=auth_headers)
    assert create.status_code == 201
    job_id = create.json()["id"]

    run = smoke_client.post(
        f"/api/v1/ingestion/sync-jobs/{job_id}/run",
        headers=auth_headers,
    )
    assert run.status_code == 202
    run_id = run.json()["run_id"]

    deadline = time.time() + 30
    final = None
    while time.time() < deadline:
        listed = smoke_client.get(
            f"/api/v1/ingestion/sync-jobs/{job_id}/runs",
            headers=auth_headers,
        )
        match = next((i for i in listed.json()["items"] if i["id"] == run_id), None)
        if match and match["status"] in ("succeeded", "failed"):
            final = match
            break
        time.sleep(0.2)
    assert final is not None
    assert final["status"] == "succeeded"
    assert final["rows_synced"] >= 1

    from sqlalchemy import create_engine, text

    engine = create_engine(integration_env["analytics_url"])
    with engine.connect() as conn:
        count = conn.execute(text(f'SELECT COUNT(*) FROM "{target_table}"')).scalar_one()
        assert count >= 1

    smoke_client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)
