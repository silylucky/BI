import os
import time
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///file:ingestion_e2e?mode=memory&cache=shared&uri=true"

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

TARGET_TABLE = "orders_clean_l1"


@pytest.fixture(scope="module", autouse=True)
def meta_tables():
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    yield


@pytest.fixture
def e2e_client(integration_env, monkeypatch):
    monkeypatch.setenv("ANALYTICS_DATABASE_URL", integration_env["analytics_url"])
    get_settings.cache_clear()
    return TestClient(app)


@pytest.mark.integration
def test_l1_sync_etl_analytics_pipeline(e2e_client, auth_headers, integration_env):
    payload = {
        "name": "l1-e2e-job",
        "source": {
            "type": "mysql",
            "host": "127.0.0.1",
            "port": 3307,
            "database": "sample_db",
            "username": "sample",
            "password": "sample",
            "table": "dirty_orders",
        },
        "target_table": TARGET_TABLE,
        "schedule_cron": None,
    }
    create = e2e_client.post("/api/v1/ingestion/sync-jobs", json=payload, headers=auth_headers)
    assert create.status_code == 201, create.text
    job_id = create.json()["id"]

    put_rules = e2e_client.put(
        f"/api/v1/ingestion/sync-jobs/{job_id}/etl-rules",
        json={"rules": L1_RULES},
        headers=auth_headers,
    )
    assert put_rules.status_code == 200

    trace_headers = {**auth_headers, "X-Trace-Id": "e2e-trace-001"}
    run = e2e_client.post(
        f"/api/v1/ingestion/sync-jobs/{job_id}/run",
        headers=trace_headers,
    )
    assert run.status_code == 202
    run_id = run.json()["run_id"]

    deadline = time.time() + 30
    final = None
    while time.time() < deadline:
        listed = e2e_client.get(f"/api/v1/ingestion/sync-jobs/{job_id}/runs", headers=auth_headers)
        items = listed.json()["items"]
        match = next((i for i in items if i["id"] == run_id), None)
        if match and match["status"] in ("succeeded", "failed"):
            final = match
            break
        time.sleep(0.5)
    assert final is not None, "run did not finish within 30s"
    assert final["status"] == "succeeded", final
    assert final["trace_id"] == "e2e-trace-001"
    assert final["rows_synced"] == 4
    assert final["error_message"] is None

    engine = create_engine(integration_env["analytics_url"])
    with engine.connect() as conn:
        count = conn.execute(text(f'SELECT COUNT(*) FROM "{TARGET_TABLE}"')).scalar_one()
        assert count == 4
        widget_a = conn.execute(
            text(f'SELECT note FROM "{TARGET_TABLE}" WHERE product = :p'),
            {"p": "Widget A"},
        ).scalar_one()
        assert widget_a == "无备注"
        widget_c = conn.execute(
            text(f'SELECT COUNT(*) FROM "{TARGET_TABLE}" WHERE product = :p'),
            {"p": "Widget C"},
        ).scalar_one()
        assert widget_c == 0

    e2e_client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)
    with engine.begin() as conn:
        conn.execute(text(f'DROP TABLE IF EXISTS "{TARGET_TABLE}"'))
    engine.dispose()
