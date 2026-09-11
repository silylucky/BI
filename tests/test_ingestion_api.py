import os
import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///file:ingestion_test?mode=memory&cache=shared&uri=true"
os.environ.setdefault(
    "ANALYTICS_DATABASE_URL",
    "postgresql+psycopg://vitalspan:vitalspan@localhost:5433/analytics",
)

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.core.config import get_settings
from app.ingestion.models import Base, get_meta_engine
from app.main import app

get_settings.cache_clear()
get_meta_engine.cache_clear()

from app.core.crypto.credentials import encrypt_credential
from app.datasources.models import Base as DatasourceBase, DataSource


@pytest.fixture(scope="module", autouse=True)
def ensure_ingestion_tables():
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    import app.metadata.dataset.models  # noqa: F401
    import app.query.config_store.models  # noqa: F401
    from app.datasources.models import Base as MetaBase

    MetaBase.metadata.create_all(engine)
    yield
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM ingestion_sync_runs"))
        conn.execute(text("DELETE FROM ingestion_etl_rules"))
        conn.execute(text("DELETE FROM ingestion_sync_jobs"))


@pytest.fixture(scope="module", autouse=True)
def ensure_datasource_table(ensure_ingestion_tables):
    engine = get_meta_engine()
    DatasourceBase.metadata.create_all(engine)
    yield
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM data_sources"))


def _seed_mysql_datasource(db_session=None) -> uuid.UUID:
    suffix = uuid.uuid4().hex[:8]
    db = db_session or get_meta_session()
    row = DataSource(
        name=f"sample-mysql-ds-{suffix}",
        code=f"sample_mysql_sync_{suffix}",
        type="mysql",
        host="127.0.0.1",
        port=3307,
        database="sample_db",
        username="sample",
        password_encrypted=encrypt_credential("sample"),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    ds_id = row.id
    if db_session is None:
        db.close()
    return ds_id


@pytest.fixture
def mysql_datasource_id() -> uuid.UUID:
    return _seed_mysql_datasource()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def job_payload(mysql_datasource_id: uuid.UUID) -> dict:
    return {
        "name": "sample-mysql-orders",
        "source_mode": "datasource",
        "source_data_source_id": str(mysql_datasource_id),
        "source_table": "dirty_orders",
        "target_table": "orders_clean",
        "schedule_cron": None,
    }


def test_sync_jobs_list_requires_auth(client: TestClient):
    response = client.get("/api/v1/ingestion/sync-jobs")
    assert response.status_code == 401


def test_sync_jobs_crud_roundtrip(client: TestClient, auth_headers: dict, job_payload: dict):
    create = client.post("/api/v1/ingestion/sync-jobs", json=job_payload, headers=auth_headers)
    assert create.status_code == 201, create.text
    body = create.json()
    job_id = body["id"]
    assert body["name"] == job_payload["name"]
    assert body["source"]["password"] == "***"

    listed = client.get("/api/v1/ingestion/sync-jobs", headers=auth_headers)
    assert listed.status_code == 200
    assert any(item["id"] == job_id for item in listed.json()["items"])

    detail = client.get(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)
    assert detail.status_code == 200
    assert detail.json()["target_table"] == "orders_clean"

    delete = client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)
    assert delete.status_code == 204


def test_sync_job_duplicate_target_table_rejected(
    client: TestClient, auth_headers: dict, job_payload: dict,
):
    first = client.post("/api/v1/ingestion/sync-jobs", json=job_payload, headers=auth_headers)
    assert first.status_code == 201, first.text
    dup_payload = {**job_payload, "name": "another-job"}
    dup = client.post("/api/v1/ingestion/sync-jobs", json=dup_payload, headers=auth_headers)
    assert dup.status_code == 409, dup.text
    assert dup.json()["detail"]["code"] == "SYNC_TARGET_TABLE_CONFLICT"
    client.delete(f"/api/v1/ingestion/sync-jobs/{first.json()['id']}", headers=auth_headers)


def test_sync_job_consume_hints(client: TestClient, auth_headers: dict, job_payload: dict):
    create = client.post("/api/v1/ingestion/sync-jobs", json=job_payload, headers=auth_headers)
    assert create.status_code == 201, create.text
    job_id = create.json()["id"]

    resp = client.get(
        f"/api/v1/ingestion/sync-jobs/{job_id}/consume-hints",
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["targetTable"] == "orders_clean"
    assert body["suggestedDatasetId"] == "orders_clean"
    assert "analyticsDatasourceId" in body
    assert "analyticsReady" in body
    assert "nextAction" in body
    assert "consumeLabel" in body

    client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)


def test_prepare_consume_endpoint(client: TestClient, auth_headers: dict, job_payload: dict):
    create = client.post("/api/v1/ingestion/sync-jobs", json=job_payload, headers=auth_headers)
    job_id = create.json()["id"]
    with patch("app.ingestion.sync_consume.ensure_analytics_datasource", return_value=uuid.uuid4()):
        resp = client.post(
            f"/api/v1/ingestion/sync-jobs/{job_id}/prepare-consume",
            headers=auth_headers,
        )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["analyticsReady"] is True
    client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)


def test_ensure_dataset_endpoint(client: TestClient, auth_headers: dict, job_payload: dict):
    create = client.post("/api/v1/ingestion/sync-jobs", json=job_payload, headers=auth_headers)
    job_id = create.json()["id"]
    bound_id = uuid.uuid4()
    with patch(
        "app.ingestion.sync_consume.ensure_dataset_for_sync_job",
        return_value=MagicMock(
            dataset_id="orders_clean",
            bound_config_id=bound_id,
            created=True,
            bound=True,
        ),
    ):
        resp = client.post(
            f"/api/v1/ingestion/sync-jobs/{job_id}/ensure-dataset",
            headers=auth_headers,
        )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["datasetId"] == "orders_clean"
    assert body["bound"] is True
    client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)


def test_ensure_dataset_endpoint_chain(client: TestClient, auth_headers: dict, job_payload: dict):
    """CHAIN：endpoint 不 mock ensure_dataset_for_sync_job，仅 stub 外连列元数据。"""
    dataset_id = f"chain_{uuid.uuid4().hex[:8]}"
    payload = {**job_payload, "target_table": dataset_id}
    create = client.post("/api/v1/ingestion/sync-jobs", json=payload, headers=auth_headers)
    assert create.status_code == 201, create.text
    job_id = create.json()["id"]
    ds_id = uuid.uuid4()
    mock_columns = MagicMock()
    mock_columns.items = [SimpleNamespace(name="id"), SimpleNamespace(name="amount")]

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
        resp = client.post(
            f"/api/v1/ingestion/sync-jobs/{job_id}/ensure-dataset",
            headers=auth_headers,
        )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["datasetId"] == dataset_id
    assert body["bound"] is True
    assert body["boundConfigId"]

    detail = client.get(f"/api/v1/datasets/{dataset_id}", headers=auth_headers)
    assert detail.status_code == 200
    assert detail.json()["datasetId"] == dataset_id

    client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)
    gone = client.get(f"/api/v1/datasets/{dataset_id}", headers=auth_headers)
    assert gone.status_code == 404


def test_create_job_missing_datasource_id_422(client, auth_headers, mysql_datasource_id):
    """datasource 模式缺 source_data_source_id → 422。"""
    payload = {
        "name": "missing-ds",
        "source_mode": "datasource",
        "source_table": "dirty_orders",
        "target_table": "orders_clean",
        "schedule_cron": None,
    }
    response = client.post("/api/v1/ingestion/sync-jobs", json=payload, headers=auth_headers)
    assert response.status_code == 422


def test_trigger_run_without_analytics_503(client, auth_headers, job_payload):
    create = client.post("/api/v1/ingestion/sync-jobs", json=job_payload, headers=auth_headers)
    job_id = create.json()["id"]
    with patch("app.api.v1.ingestion.sync.get_settings") as mock_get:
        mock_get.return_value.analytics_database_url = None
        response = client.post(
            f"/api/v1/ingestion/sync-jobs/{job_id}/run",
            headers=auth_headers,
        )
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "ANALYTICS_DB_NOT_CONFIGURED"
    client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)


def test_trigger_run_not_found_404(client, auth_headers):
    missing = uuid.uuid4()
    response = client.post(
        f"/api/v1/ingestion/sync-jobs/{missing}/run",
        headers=auth_headers,
    )
    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "NOT_FOUND"


def test_list_runs_empty(client, auth_headers, job_payload):
    create = client.post("/api/v1/ingestion/sync-jobs", json=job_payload, headers=auth_headers)
    job_id = create.json()["id"]
    listed = client.get(f"/api/v1/ingestion/sync-jobs/{job_id}/runs", headers=auth_headers)
    assert listed.status_code == 200
    assert listed.json()["items"] == []
    client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)


def test_put_etl_rules_roundtrip(client, auth_headers, job_payload):
    rules = [
        {"type": "rename_column", "from": "product_name", "to": "product"},
        {"type": "filter_rows", "column": "status", "op": "ne", "value": "deleted"},
    ]
    create = client.post("/api/v1/ingestion/sync-jobs", json=job_payload, headers=auth_headers)
    job_id = create.json()["id"]
    put = client.put(
        f"/api/v1/ingestion/sync-jobs/{job_id}/etl-rules",
        json={"rules": rules},
        headers=auth_headers,
    )
    assert put.status_code == 200
    assert put.json()["rules"] == rules
    got = client.get(f"/api/v1/ingestion/sync-jobs/{job_id}/etl-rules", headers=auth_headers)
    assert got.json()["rules"] == rules
    client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)


from datetime import datetime, timezone

from app.ingestion.models import SyncJob, SyncRun, get_meta_session


def test_update_sync_job_put_roundtrip(client, auth_headers, job_payload):
    """T-D01-09: PUT 更新 name/target_table → GET 一致。"""
    create = client.post("/api/v1/ingestion/sync-jobs", json=job_payload, headers=auth_headers)
    job_id = create.json()["id"]
    updated = {
        **job_payload,
        "name": "renamed-job",
        "target_table": "orders_renamed",
    }
    put = client.put(
        f"/api/v1/ingestion/sync-jobs/{job_id}",
        json=updated,
        headers=auth_headers,
    )
    assert put.status_code == 200
    assert put.json()["name"] == "renamed-job"
    assert put.json()["target_table"] == "orders_renamed"
    got = client.get(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)
    assert got.json()["name"] == "renamed-job"
    client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)


def test_create_job_invalid_datasource_id_404(client, auth_headers, job_payload):
    """不存在的 source_data_source_id → 404。"""
    bad = {**job_payload, "source_data_source_id": str(uuid.uuid4())}
    response = client.post("/api/v1/ingestion/sync-jobs", json=bad, headers=auth_headers)
    assert response.status_code == 404


def test_trigger_run_conflict_when_running_exists_409(client, auth_headers, job_payload):
    """T-D01-11: 已有 running run → POST run 409。"""
    create = client.post("/api/v1/ingestion/sync-jobs", json=job_payload, headers=auth_headers)
    job_id = uuid.UUID(create.json()["id"])
    db = get_meta_session()
    db.add(
        SyncRun(
            job_id=job_id,
            status="running",
            trace_id="seed-running",
            started_at=datetime.now(timezone.utc),
        )
    )
    db.commit()
    db.close()
    with patch("app.api.v1.ingestion.sync.get_settings") as mock_get:
        mock_get.return_value.analytics_database_url = "postgresql+psycopg://u:p@localhost:5433/a"
        response = client.post(
            f"/api/v1/ingestion/sync-jobs/{job_id}/run",
            headers=auth_headers,
        )
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "RUN_ALREADY_IN_PROGRESS"
    client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)


def test_trigger_run_target_table_busy_409(client, auth_headers, job_payload, mysql_datasource_id):
    """另一任务正在写同一 target_table → POST run 409 SYNC_TARGET_TABLE_BUSY。"""
    first = client.post("/api/v1/ingestion/sync-jobs", json=job_payload, headers=auth_headers)
    assert first.status_code == 201, first.text
    second_payload = {
        **job_payload,
        "name": "job-b-other",
        "target_table": f"orders_clean_{uuid.uuid4().hex[:6]}",
    }
    second = client.post("/api/v1/ingestion/sync-jobs", json=second_payload, headers=auth_headers)
    assert second.status_code == 201, second.text
    shared_table = job_payload["target_table"]
    db = get_meta_session()
    job_b = db.get(SyncJob, uuid.UUID(second.json()["id"]))
    assert job_b is not None
    job_b.target_table = shared_table
    db.add(
        SyncRun(
            job_id=job_b.id,
            status="running",
            trace_id="busy-other",
            started_at=datetime.now(timezone.utc),
        )
    )
    db.commit()
    db.close()
    with patch("app.api.v1.ingestion.sync.get_settings") as mock_get:
        mock_get.return_value.analytics_database_url = "postgresql+psycopg://u:p@localhost:5433/a"
        response = client.post(
            f"/api/v1/ingestion/sync-jobs/{first.json()['id']}/run",
            headers=auth_headers,
        )
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "SYNC_TARGET_TABLE_BUSY"
    client.delete(f"/api/v1/ingestion/sync-jobs/{first.json()['id']}", headers=auth_headers)
    client.delete(f"/api/v1/ingestion/sync-jobs/{second.json()['id']}", headers=auth_headers)


def test_create_rest_api_job_seeds_default_etl_rules(client, auth_headers):
    ds_suffix = uuid.uuid4().hex[:8]
    db = get_meta_session()
    row = DataSource(
        name=f"rest-ds-{ds_suffix}",
        code=f"rest_ds_{ds_suffix}",
        type="rest_api",
        host="http://127.0.0.1:8000",
        port=8000,
        database="",
        username="",
        password_encrypted=encrypt_credential(""),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    ds_id = row.id
    db.close()
    payload = {
        "name": "rest-orders",
        "source_mode": "datasource",
        "source_data_source_id": str(ds_id),
        "source_table": "/sample-api/orders",
        "target_table": f"orders_clean_{ds_suffix}",
        "schedule_cron": None,
    }
    create = client.post("/api/v1/ingestion/sync-jobs", json=payload, headers=auth_headers)
    assert create.status_code == 201, create.text
    job_id = create.json()["id"]
    rules = client.get(f"/api/v1/ingestion/sync-jobs/{job_id}/etl-rules", headers=auth_headers)
    assert rules.status_code == 200
    assert len(rules.json()["rules"]) >= 1
    client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)


def test_create_job_seeds_etl_rules_from_source_columns(
    client: TestClient,
    auth_headers: dict,
    mysql_datasource_id: uuid.UUID,
) -> None:
    from app.datasources.schemas import ColumnItemOut, ColumnListResponse

    columns = ColumnListResponse(
        items=[
            ColumnItemOut(name="product_name", data_type="varchar", nullable=True),
            ColumnItemOut(name="amount", data_type="varchar", nullable=True),
            ColumnItemOut(name="status", data_type="varchar", nullable=True),
        ],
    )
    target_table = f"sales_clean_{uuid.uuid4().hex[:8]}"
    payload = {
        "name": "auto-etl-job",
        "source_mode": "datasource",
        "source_data_source_id": str(mysql_datasource_id),
        "source_table": "sales_orders",
        "target_table": target_table,
        "schedule_cron": None,
    }
    with patch("app.ingestion.etl_seed.list_columns", return_value=columns):
        create = client.post("/api/v1/ingestion/sync-jobs", json=payload, headers=auth_headers)
    assert create.status_code == 201, create.text
    job_id = create.json()["id"]
    rules = client.get(f"/api/v1/ingestion/sync-jobs/{job_id}/etl-rules", headers=auth_headers)
    assert rules.status_code == 200
    body = rules.json()["rules"]
    assert {"type": "rename_column", "from": "product_name", "to": "product"} in body
    assert {"type": "cast_type", "column": "amount", "to": "float"} in body
    assert {
        "type": "filter_rows",
        "column": "status",
        "op": "ne",
        "value": "deleted",
    } in body
    hints = client.get(
        f"/api/v1/ingestion/sync-jobs/{job_id}/consume-hints",
        headers=auth_headers,
    )
    assert hints.status_code == 200
    assert hints.json()["etlRulesConfigured"] is True
    assert hints.json()["etlRulesCount"] == len(body)
    client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)


def test_auto_align_etl_rules_regenerates_from_columns(
    client: TestClient,
    auth_headers: dict,
    mysql_datasource_id: uuid.UUID,
) -> None:
    from app.datasources.schemas import ColumnItemOut, ColumnListResponse

    columns = ColumnListResponse(
        items=[
            ColumnItemOut(name="amount", data_type="varchar", nullable=True),
            ColumnItemOut(name="status", data_type="varchar", nullable=True),
        ],
    )
    target_table = f"auto_align_{uuid.uuid4().hex[:8]}"
    payload = {
        "name": "auto-align-job",
        "source_mode": "datasource",
        "source_data_source_id": str(mysql_datasource_id),
        "source_table": "metrics",
        "target_table": target_table,
        "schedule_cron": None,
    }
    with patch("app.ingestion.etl_seed.list_columns", return_value=ColumnListResponse(items=[])):
        create = client.post("/api/v1/ingestion/sync-jobs", json=payload, headers=auth_headers)
    assert create.status_code == 201, create.text
    job_id = create.json()["id"]
    with patch("app.ingestion.etl_seed.list_columns", return_value=columns):
        aligned = client.post(
            f"/api/v1/ingestion/sync-jobs/{job_id}/etl-rules/auto-align",
            headers=auth_headers,
        )
    assert aligned.status_code == 200, aligned.text
    body = aligned.json()["rules"]
    assert {"type": "cast_type", "column": "amount", "to": "float"} in body
    assert {
        "type": "filter_rows",
        "column": "status",
        "op": "ne",
        "value": "deleted",
    } in body


def test_update_job_reseeds_etl_when_source_changes_and_rules_empty(
    client: TestClient,
    auth_headers: dict,
    mysql_datasource_id: uuid.UUID,
) -> None:
    from app.datasources.schemas import ColumnItemOut, ColumnListResponse

    empty_columns = ColumnListResponse(items=[])
    new_columns = ColumnListResponse(
        items=[ColumnItemOut(name="product_name", data_type="varchar", nullable=True)],
    )
    target_table = f"reseed_clean_{uuid.uuid4().hex[:8]}"
    payload = {
        "name": "reseed-etl-job",
        "source_mode": "datasource",
        "source_data_source_id": str(mysql_datasource_id),
        "source_table": "legacy_table",
        "target_table": target_table,
        "schedule_cron": None,
    }
    with patch("app.ingestion.etl_seed.list_columns", return_value=empty_columns):
        create = client.post("/api/v1/ingestion/sync-jobs", json=payload, headers=auth_headers)
    assert create.status_code == 201, create.text
    job_id = create.json()["id"]
    rules_before = client.get(
        f"/api/v1/ingestion/sync-jobs/{job_id}/etl-rules",
        headers=auth_headers,
    )
    assert rules_before.json()["rules"] == []

    updated = {**payload, "source_table": "sales_orders"}
    with patch("app.ingestion.etl_seed.list_columns", return_value=new_columns):
        put = client.put(
            f"/api/v1/ingestion/sync-jobs/{job_id}",
            json=updated,
            headers=auth_headers,
        )
    assert put.status_code == 200, put.text
    rules_after = client.get(
        f"/api/v1/ingestion/sync-jobs/{job_id}/etl-rules",
        headers=auth_headers,
    )
    assert {"type": "rename_column", "from": "product_name", "to": "product"} in rules_after.json()[
        "rules"
    ]
    client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)


def test_update_job_keeps_etl_rules_when_source_changes_and_rules_nonempty(
    client: TestClient,
    auth_headers: dict,
    mysql_datasource_id: uuid.UUID,
) -> None:
    from app.datasources.schemas import ColumnItemOut, ColumnListResponse

    initial_columns = ColumnListResponse(
        items=[ColumnItemOut(name="product_name", data_type="varchar", nullable=True)],
    )
    other_columns = ColumnListResponse(
        items=[ColumnItemOut(name="note", data_type="text", nullable=True)],
    )
    target_table = f"keep_rules_{uuid.uuid4().hex[:8]}"
    payload = {
        "name": "keep-etl-job",
        "source_mode": "datasource",
        "source_data_source_id": str(mysql_datasource_id),
        "source_table": "sales_orders",
        "target_table": target_table,
        "schedule_cron": None,
    }
    with patch("app.ingestion.etl_seed.list_columns", return_value=initial_columns):
        create = client.post("/api/v1/ingestion/sync-jobs", json=payload, headers=auth_headers)
    assert create.status_code == 201, create.text
    job_id = create.json()["id"]
    custom_rules = [{"type": "fill_null", "column": "note", "value": "自定义"}]
    saved = client.put(
        f"/api/v1/ingestion/sync-jobs/{job_id}/etl-rules",
        json={"rules": custom_rules},
        headers=auth_headers,
    )
    assert saved.status_code == 200

    updated = {**payload, "source_table": "notes_table"}
    with patch("app.ingestion.etl_seed.list_columns", return_value=other_columns):
        put = client.put(
            f"/api/v1/ingestion/sync-jobs/{job_id}",
            json=updated,
            headers=auth_headers,
        )
    assert put.status_code == 200, put.text
    rules_after = client.get(
        f"/api/v1/ingestion/sync-jobs/{job_id}/etl-rules",
        headers=auth_headers,
    )
    assert rules_after.json()["rules"] == custom_rules
    client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)


def test_create_job_invalid_cron_422(client, auth_headers, job_payload):
    bad = {**job_payload, "schedule_cron": "not-a-cron"}
    response = client.post("/api/v1/ingestion/sync-jobs", json=bad, headers=auth_headers)
    assert response.status_code == 422


def test_list_sync_jobs_includes_last_run(client, auth_headers, job_payload):
    create = client.post("/api/v1/ingestion/sync-jobs", json=job_payload, headers=auth_headers)
    job_id = create.json()["id"]
    db = get_meta_session()
    db.add(
        SyncRun(
            job_id=uuid.UUID(job_id),
            status="succeeded",
            trace_id="list-last-run",
            started_at=datetime.now(timezone.utc),
            finished_at=datetime.now(timezone.utc),
            rows_synced=12,
        )
    )
    db.commit()
    db.close()

    listed = client.get("/api/v1/ingestion/sync-jobs", headers=auth_headers)
    assert listed.status_code == 200
    item = next(i for i in listed.json()["items"] if i["id"] == job_id)
    assert item["last_run"] is not None
    assert item["last_run"]["status"] == "succeeded"
    assert item["last_run"]["rows_synced"] == 12

    client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)


def test_get_sync_job_includes_last_run(client, auth_headers, job_payload):
    create = client.post("/api/v1/ingestion/sync-jobs", json=job_payload, headers=auth_headers)
    job_id = create.json()["id"]
    db = get_meta_session()
    db.add(
        SyncRun(
            job_id=uuid.UUID(job_id),
            status="succeeded",
            trace_id="get-last-run",
            started_at=datetime.now(timezone.utc),
            finished_at=datetime.now(timezone.utc),
            rows_synced=7,
        )
    )
    db.commit()
    db.close()

    detail = client.get(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)
    assert detail.status_code == 200
    body = detail.json()
    assert body["last_run"] is not None
    assert body["last_run"]["status"] == "succeeded"
    assert body["last_run"]["rows_synced"] == 7

    client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)


def test_openapi_lists_ingestion_sync_job_routes(client):
    """T-D01-12: OpenAPI paths 含 sync-jobs CRUD、run、runs、etl-rules。"""
    paths = client.get("/openapi.json").json()["paths"]
    for fragment in (
        "/ingestion/sync-jobs",
        "/ingestion/sync-jobs/{job_id}/run",
        "/ingestion/sync-jobs/{job_id}/cancel",
        "/ingestion/sync-jobs/{job_id}/runs",
        "/ingestion/sync-jobs/{job_id}/etl-rules",
    ):
        assert any(fragment in p for p in paths), fragment


@patch("app.api.v1.ingestion.sync.run_job")
def test_cancel_run_marks_cancelling(mock_run_job, client, auth_headers, job_payload):
    mock_run_job.return_value = None
    create = client.post("/api/v1/ingestion/sync-jobs", json=job_payload, headers=auth_headers)
    job_id = create.json()["id"]
    with patch("app.api.v1.ingestion.sync.get_settings") as mock_get:
        mock_get.return_value.analytics_database_url = "postgresql+psycopg://u:p@localhost:5433/a"
        run_resp = client.post(f"/api/v1/ingestion/sync-jobs/{job_id}/run", headers=auth_headers)
        assert run_resp.status_code == 202
        cancel_resp = client.post(f"/api/v1/ingestion/sync-jobs/{job_id}/cancel", headers=auth_headers)
    assert cancel_resp.status_code == 200
    body = cancel_resp.json()
    assert body["status"] == "cancelling"
    assert body["run_id"] == run_resp.json()["run_id"]
    client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)


def test_cancel_run_when_idle_409(client, auth_headers, job_payload):
    create = client.post("/api/v1/ingestion/sync-jobs", json=job_payload, headers=auth_headers)
    job_id = create.json()["id"]
    cancel_resp = client.post(f"/api/v1/ingestion/sync-jobs/{job_id}/cancel", headers=auth_headers)
    assert cancel_resp.status_code == 409
    assert cancel_resp.json()["detail"]["code"] == "RUN_NOT_IN_PROGRESS"
    client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)


@patch("app.api.v1.ingestion.sync.run_job")
def test_trigger_run_manual_accepted_202(mock_run_job, client, auth_headers, job_payload):
    """T-D01-13: 手动 run 202 + run_id。"""
    create = client.post("/api/v1/ingestion/sync-jobs", json=job_payload, headers=auth_headers)
    job_id = create.json()["id"]
    with patch("app.api.v1.ingestion.sync.get_settings") as mock_get:
        mock_get.return_value.analytics_database_url = "postgresql+psycopg://u:p@localhost:5433/a"
        response = client.post(
            f"/api/v1/ingestion/sync-jobs/{job_id}/run",
            headers=auth_headers,
        )
    assert response.status_code == 202
    body = response.json()
    assert body["status"] == "running"
    assert "run_id" in body
    client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)


import time


def test_get_and_delete_job_not_found_404(client, auth_headers):
    """T-D01-14: GET/DELETE 不存在 job → 404 NOT_FOUND。"""
    missing = uuid.uuid4()
    get_resp = client.get(f"/api/v1/ingestion/sync-jobs/{missing}", headers=auth_headers)
    assert get_resp.status_code == 404
    assert get_resp.json()["detail"]["code"] == "NOT_FOUND"

    del_resp = client.delete(f"/api/v1/ingestion/sync-jobs/{missing}", headers=auth_headers)
    assert del_resp.status_code == 404
    assert del_resp.json()["detail"]["code"] == "NOT_FOUND"


def test_list_runs_respects_limit_param(client, auth_headers, job_payload):
    """T-D01-15: GET .../runs?limit=5 尊重 limit。"""
    create = client.post("/api/v1/ingestion/sync-jobs", json=job_payload, headers=auth_headers)
    job_id = uuid.UUID(create.json()["id"])
    db = get_meta_session()
    for i in range(6):
        db.add(
            SyncRun(
                job_id=job_id,
                status="succeeded",
                trace_id=f"seed-run-{i}",
                started_at=datetime.now(timezone.utc),
                finished_at=datetime.now(timezone.utc),
                rows_synced=i,
            )
        )
    db.commit()
    db.close()

    listed = client.get(
        f"/api/v1/ingestion/sync-jobs/{job_id}/runs?limit=5",
        headers=auth_headers,
    )
    assert listed.status_code == 200
    assert len(listed.json()["items"]) <= 5

    client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)


@patch("app.api.v1.ingestion.sync.run_job")
def test_trigger_run_consecutive_post_second_409(mock_run_job, client, auth_headers, job_payload):
    """T-D01-16: 连续两次 POST run → 第二次 409（run_job mock 保持 running）。"""
    mock_run_job.return_value = None
    create = client.post("/api/v1/ingestion/sync-jobs", json=job_payload, headers=auth_headers)
    job_id = create.json()["id"]
    with patch("app.api.v1.ingestion.sync.get_settings") as mock_get:
        mock_get.return_value.analytics_database_url = "postgresql+psycopg://u:p@localhost:5433/a"
        first = client.post(
            f"/api/v1/ingestion/sync-jobs/{job_id}/run",
            headers=auth_headers,
        )
        assert first.status_code == 202
        second = client.post(
            f"/api/v1/ingestion/sync-jobs/{job_id}/run",
            headers=auth_headers,
        )
    assert second.status_code == 409
    assert second.json()["detail"]["code"] == "RUN_ALREADY_IN_PROGRESS"
    client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)


def test_openapi_ingestion_tag_on_post_run(client):
    """T-D01-17: OpenAPI POST run operation 含 ingestion tag。"""
    spec = client.get("/openapi.json").json()
    run_path = next(
        p for p in spec["paths"] if p.endswith("/sync-jobs/{job_id}/run")
    )
    post_op = spec["paths"][run_path]["post"]
    assert "ingestion" in post_op.get("tags", [])


@patch("app.api.v1.ingestion.sync.run_job")
def test_trigger_run_accepts_within_one_second(mock_run_job, client, auth_headers, job_payload):
    """T-D01-18: 手动 run 接受响应耗时 <1.0s。"""
    mock_run_job.return_value = None
    create = client.post("/api/v1/ingestion/sync-jobs", json=job_payload, headers=auth_headers)
    job_id = create.json()["id"]
    with patch("app.api.v1.ingestion.sync.get_settings") as mock_get:
        mock_get.return_value.analytics_database_url = "postgresql+psycopg://u:p@localhost:5433/a"
        start = time.perf_counter()
        response = client.post(
            f"/api/v1/ingestion/sync-jobs/{job_id}/run",
            headers=auth_headers,
        )
        elapsed = time.perf_counter() - start
    assert response.status_code == 202
    assert elapsed < 1.0
    client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)


INGESTION_OPENAPI_PATHS = {
    "/api/v1/ingestion/sync-jobs": {"get", "post"},
    "/api/v1/ingestion/sync-jobs/{job_id}": {"get", "put", "delete"},
    "/api/v1/ingestion/sync-jobs/{job_id}/run": {"post"},
    "/api/v1/ingestion/sync-jobs/{job_id}/cancel": {"post"},
    "/api/v1/ingestion/sync-jobs/{job_id}/runs": {"get"},
    "/api/v1/ingestion/sync-jobs/{job_id}/etl-rules": {"get", "put"},
    "/api/v1/ingestion/sync-jobs/{job_id}/etl-rules/auto-align": {"post"},
}


def test_openapi_ingestion_contract_snapshot(client):
    """T-D01-19: ingestion 5 path 的 method/tags 与 SyncJobCreate/SourceConnectionIn 必填字段。"""
    spec = client.get("/openapi.json").json()
    paths = spec["paths"]
    for path, methods in INGESTION_OPENAPI_PATHS.items():
        assert path in paths, path
        for method in methods:
            op = paths[path][method]
            assert "ingestion" in op.get("tags", []), f"{method} {path}"
    components = spec["components"]["schemas"]
    create_required = set(components["SyncJobCreate"]["required"])
    assert {"name", "target_table"}.issubset(create_required)
    # inline 模式：source 可选；datasource 模式：source_data_source_id + source_table
    src_required = set(components["SourceConnectionIn"]["required"])
    assert {"type", "host", "port", "database", "username", "password", "table"}.issubset(
        src_required
    )


def test_create_job_inline_mode_rejected_422(client, auth_headers, mysql_datasource_id):
    """内联模式已停用 → 422。"""
    payload = {
        "name": "inline-rejected",
        "source_mode": "inline",
        "source": {
            "type": "mysql",
            "host": "127.0.0.1",
            "port": 3307,
            "database": "sample_db",
            "username": "sample",
            "password": "sample",
            "table": "dirty_orders",
        },
        "target_table": "orders_clean",
        "schedule_cron": None,
    }
    response = client.post("/api/v1/ingestion/sync-jobs", json=payload, headers=auth_headers)
    assert response.status_code == 422


def test_create_job_datasource_missing_source_table_422(client, auth_headers, mysql_datasource_id):
    """datasource 模式缺 source_table → 422。"""
    payload = {
        "name": "missing-table",
        "source_mode": "datasource",
        "source_data_source_id": str(mysql_datasource_id),
        "target_table": "orders_clean",
        "schedule_cron": None,
    }
    response = client.post("/api/v1/ingestion/sync-jobs", json=payload, headers=auth_headers)
    assert response.status_code == 422


def test_put_etl_rules_idempotent(client, auth_headers, job_payload):
    """T-D01-21: 同一 rules 连续 PUT 两次 → 均 200 且 GET 一致。"""
    rules = [
        {"type": "rename_column", "from": "product_name", "to": "product"},
        {"type": "filter_rows", "column": "status", "op": "ne", "value": "deleted"},
    ]
    create = client.post("/api/v1/ingestion/sync-jobs", json=job_payload, headers=auth_headers)
    job_id = create.json()["id"]
    for _ in range(2):
        put = client.put(
            f"/api/v1/ingestion/sync-jobs/{job_id}/etl-rules",
            json={"rules": rules},
            headers=auth_headers,
        )
        assert put.status_code == 200
        assert put.json()["rules"] == rules
    got = client.get(f"/api/v1/ingestion/sync-jobs/{job_id}/etl-rules", headers=auth_headers)
    assert got.json()["rules"] == rules
    client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)


@patch("app.api.v1.ingestion.sync.run_job")
def test_trigger_run_p95_under_half_second(mock_run_job, client, auth_headers, job_payload):
    """T-D01-22: 每次新建 job 后 POST run，10 次采样 P95 <0.5s。"""
    mock_run_job.return_value = None
    durations: list[float] = []
    job_ids: list[str] = []
    with patch("app.api.v1.ingestion.sync.get_settings") as mock_get:
        mock_get.return_value.analytics_database_url = "postgresql+psycopg://u:p@localhost:5433/a"
        for _ in range(10):
            create = client.post(
                "/api/v1/ingestion/sync-jobs", json=job_payload, headers=auth_headers
            )
            assert create.status_code == 201
            job_id = create.json()["id"]
            job_ids.append(job_id)
            start = time.perf_counter()
            response = client.post(
                f"/api/v1/ingestion/sync-jobs/{job_id}/run",
                headers=auth_headers,
            )
            durations.append(time.perf_counter() - start)
            assert response.status_code == 202
    durations_sorted = sorted(durations)
    p95_index = max(0, int(len(durations_sorted) * 0.95) - 1)
    assert durations_sorted[p95_index] < 0.5
    for job_id in job_ids:
        client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)


def test_put_etl_rules_non_list_body_422(client, auth_headers, job_payload):
    """T-ETL-14: PUT etl-rules body rules 非 list → 422。"""
    create = client.post("/api/v1/ingestion/sync-jobs", json=job_payload, headers=auth_headers)
    job_id = create.json()["id"]
    response = client.put(
        f"/api/v1/ingestion/sync-jobs/{job_id}/etl-rules",
        json={"rules": "not-list"},
        headers=auth_headers,
    )
    assert response.status_code == 422
    client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)


def test_put_etl_rules_object_body_422_chinese_message(client, auth_headers, job_payload):
    """T-ETL-19: PUT etl-rules body rules 为 object 非 list → 422 + message 含规则/列表。"""
    create = client.post("/api/v1/ingestion/sync-jobs", json=job_payload, headers=auth_headers)
    job_id = create.json()["id"]
    response = client.put(
        f"/api/v1/ingestion/sync-jobs/{job_id}/etl-rules",
        json={"rules": {"type": "rename_column"}},
        headers=auth_headers,
    )
    assert response.status_code == 422
    body = response.json()
    raw = body.get("message") or body.get("detail") or body
    message = (
        " ".join(str(item.get("msg", item)) for item in raw)
        if isinstance(raw, list)
        else str(raw)
    )
    assert "规则" in message or "列表" in message
    client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)


def test_trigger_run_triple_post_all_409_when_running_seeded(client, auth_headers, job_payload):
    """T-D02-23: seed running run 后连续 3 次 POST → 均 409 RUN_ALREADY_IN_PROGRESS。"""
    create = client.post("/api/v1/ingestion/sync-jobs", json=job_payload, headers=auth_headers)
    job_id = uuid.UUID(create.json()["id"])
    db = get_meta_session()
    db.add(
        SyncRun(
            job_id=job_id,
            status="running",
            trace_id="seed-triple-409",
            started_at=datetime.now(timezone.utc),
        )
    )
    db.commit()
    db.close()
    with patch("app.api.v1.ingestion.sync.get_settings") as mock_get:
        mock_get.return_value.analytics_database_url = "postgresql+psycopg://u:p@localhost:5433/a"
        for _ in range(3):
            response = client.post(
                f"/api/v1/ingestion/sync-jobs/{job_id}/run",
                headers=auth_headers,
            )
            assert response.status_code == 409
            assert response.json()["detail"]["code"] == "RUN_ALREADY_IN_PROGRESS"
    client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)


from app.ingestion.models import SyncJob, decrypt_password


def test_put_resave_datasource_preserves_password_snapshot(client, auth_headers, job_payload):
    """PUT 重保存 datasource 任务时保留已快照的源库密码密文；GET password=='***'。"""
    create = client.post("/api/v1/ingestion/sync-jobs", json=job_payload, headers=auth_headers)
    assert create.status_code == 201
    job_id = create.json()["id"]
    assert create.json()["source"]["password"] == "***"

    db = get_meta_session()
    job = db.get(SyncJob, uuid.UUID(job_id))
    original_cipher = job.source_password_encrypted
    db.close()

    updated = {**job_payload, "name": "renamed-resave"}
    put = client.put(
        f"/api/v1/ingestion/sync-jobs/{job_id}",
        json=updated,
        headers=auth_headers,
    )
    assert put.status_code == 200

    detail = client.get(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)
    assert detail.json()["source"]["password"] == "***"

    db = get_meta_session()
    job_after = db.get(SyncJob, uuid.UUID(job_id))
    assert job_after.source_password_encrypted == original_cipher
    assert decrypt_password(job_after.source_password_encrypted) == "sample"
    db.close()

    client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)


def test_create_five_jobs_p95_under_800ms(client, auth_headers, job_payload):
    """T-D01-24: 5 次 create 不同 name P95 <0.8s；各 201。"""
    durations: list[float] = []
    job_ids: list[str] = []
    for i in range(5):
        payload = {**job_payload, "name": f"perf-create-{i}"}
        start = time.perf_counter()
        response = client.post("/api/v1/ingestion/sync-jobs", json=payload, headers=auth_headers)
        durations.append(time.perf_counter() - start)
        assert response.status_code == 201
        job_ids.append(response.json()["id"])
    durations_sorted = sorted(durations)
    p95_index = max(0, int(len(durations_sorted) * 0.95) - 1)
    assert durations_sorted[p95_index] < 0.8
    for job_id in job_ids:
        client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)


def test_create_job_with_datasource_snapshot(client, auth_headers):
    ds_id = _seed_mysql_datasource()
    payload = {
        "name": "ds-ref-job",
        "source_mode": "datasource",
        "source_data_source_id": str(ds_id),
        "source_table": "dirty_orders",
        "target_table": "orders_from_ds",
        "schedule_cron": None,
    }
    create = client.post("/api/v1/ingestion/sync-jobs", json=payload, headers=auth_headers)
    assert create.status_code == 201, create.text
    body = create.json()
    job_id = body["id"]
    assert body["source"]["host"] == "127.0.0.1"
    assert body["source"]["database"] == "sample_db"
    assert body["source"]["table"] == "dirty_orders"

    listed = client.get("/api/v1/ingestion/sync-jobs", headers=auth_headers)
    item = next(i for i in listed.json()["items"] if i["id"] == job_id)
    assert item["source_data_source_id"] == str(ds_id)
    db = get_meta_session()
    ds_row = db.get(DataSource, ds_id)
    assert item["source_label"] == ds_row.name
    db.close()

    client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)


def test_update_sync_job_datasource_roundtrip(client, auth_headers):
    """T5-put-datasource-update: PUT 换数据源与源表 → GET 快照一致。"""
    ds_a = _seed_mysql_datasource()
    db = get_meta_session()
    row_b = DataSource(
        name="second-mysql-ds",
        code="sample_mysql_sync_b",
        type="mysql",
        host="10.0.0.2",
        port=3308,
        database="other_db",
        username="other",
        password_encrypted=encrypt_credential("other"),
    )
    db.add(row_b)
    db.commit()
    db.refresh(row_b)
    ds_b = row_b.id
    db.close()

    create = client.post(
        "/api/v1/ingestion/sync-jobs",
        json={
            "name": "ds-job-before-update",
            "source_mode": "datasource",
            "source_data_source_id": str(ds_a),
            "source_table": "dirty_orders",
            "target_table": "orders_from_ds",
            "schedule_cron": None,
        },
        headers=auth_headers,
    )
    assert create.status_code == 201, create.text
    job_id = create.json()["id"]

    updated = client.put(
        f"/api/v1/ingestion/sync-jobs/{job_id}",
        json={
            "name": "ds-job-after-update",
            "source_mode": "datasource",
            "source_data_source_id": str(ds_b),
            "source_table": "orders_live",
            "target_table": "orders_from_ds_v2",
            "schedule_cron": "0 3 * * *",
            "enabled": True,
            "sync_mode": "incremental",
            "primary_key": "id",
            "incremental_column": "updated_at",
        },
        headers=auth_headers,
    )
    assert updated.status_code == 200, updated.text
    body = updated.json()
    assert body["name"] == "ds-job-after-update"
    assert body["target_table"] == "orders_from_ds_v2"
    assert body["sync_mode"] == "incremental"
    assert body["source"]["host"] == "10.0.0.2"
    assert body["source"]["port"] == 3308
    assert body["source"]["database"] == "other_db"
    assert body["source"]["table"] == "orders_live"
    assert body["source_data_source_id"] == str(ds_b)

    got = client.get(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)
    assert got.status_code == 200
    detail = got.json()
    assert detail["source"]["table"] == "orders_live"
    assert detail["primary_key"] == "id"
    assert detail["incremental_column"] == "updated_at"

    client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)


def test_update_sync_job_rest_api_source_path(client, auth_headers):
    """REST API 同步任务的 source_table 可为 /sample-api/orders 路径。"""
    db = get_meta_session()
    row = DataSource(
        name="rest-api-ds",
        code="rest_api_sync_test",
        type="rest_api",
        host="http://127.0.0.1:8000",
        port=8000,
        database="/sample-api/health",
        username="none",
        password_encrypted=encrypt_credential("-"),
    )
    db.add(row)
    db.commit()
    ds_id = row.id
    db.close()

    create = client.post(
        "/api/v1/ingestion/sync-jobs",
        json={
            "name": "rest-api-job",
            "source_mode": "datasource",
            "source_data_source_id": str(ds_id),
            "source_table": "dirty_orders",
            "target_table": "orders_from_api",
        },
        headers=auth_headers,
    )
    assert create.status_code == 201, create.text
    job_id = create.json()["id"]

    updated = client.put(
        f"/api/v1/ingestion/sync-jobs/{job_id}",
        json={
            "name": "rest-api-job",
            "source_mode": "datasource",
            "source_data_source_id": str(ds_id),
            "source_table": "/sample-api/orders",
            "target_table": "orders_from_api",
            "enabled": True,
            "sync_mode": "full",
        },
        headers=auth_headers,
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["source"]["table"] == "/sample-api/orders"

    client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)


def test_create_job_datasource_not_found_404(client, auth_headers):
    payload = {
        "name": "bad-ds",
        "source_mode": "datasource",
        "source_data_source_id": str(uuid.uuid4()),
        "source_table": "t",
        "target_table": "tgt",
    }
    response = client.post("/api/v1/ingestion/sync-jobs", json=payload, headers=auth_headers)
    assert response.status_code == 404


def test_create_job_hive_datasource_201(client, auth_headers):
    """Hive 等湖仓连接器可作同步源。"""
    db = get_meta_session()
    row = DataSource(
        name="hive-ds",
        code="hive_sync",
        type="hive",
        host="127.0.0.1",
        port=10000,
        database="default",
        username="u",
        password_encrypted=encrypt_credential("p"),
    )
    db.add(row)
    db.commit()
    ds_id = row.id
    db.close()

    payload = {
        "name": "hive-ref",
        "source_mode": "datasource",
        "source_data_source_id": str(ds_id),
        "source_table": "t",
        "target_table": "tgt_hive",
    }
    response = client.post("/api/v1/ingestion/sync-jobs", json=payload, headers=auth_headers)
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["source"]["type"] == "hive"
    client.delete(f"/api/v1/ingestion/sync-jobs/{body['id']}", headers=auth_headers)


def test_create_job_postgresql_datasource_201(client, auth_headers):
    from app.datasources.schemas import ColumnListResponse

    db = get_meta_session()
    row = DataSource(
        name="pg-ds",
        code="pg_sync",
        type="postgresql",
        host="127.0.0.1",
        port=5432,
        database="pg",
        username="u",
        password_encrypted=encrypt_credential("p"),
    )
    db.add(row)
    db.commit()
    ds_id = row.id
    db.close()

    payload = {
        "name": "pg-ref",
        "source_mode": "datasource",
        "source_data_source_id": str(ds_id),
        "source_table": "orders",
        "target_table": "orders_pg",
    }
    with patch("app.ingestion.etl_seed.list_columns", return_value=ColumnListResponse(items=[])):
        response = client.post("/api/v1/ingestion/sync-jobs", json=payload, headers=auth_headers)
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["source_data_source_id"] == str(ds_id)
    assert body["source"]["type"] == "postgresql"
    client.delete(f"/api/v1/ingestion/sync-jobs/{body['id']}", headers=auth_headers)


def test_create_job_postgresql_with_source_schema_roundtrip(client, auth_headers):
    from app.datasources.schemas import ColumnListResponse

    db = get_meta_session()
    row = DataSource(
        name="ts-ds",
        code="ts_sync",
        type="timescaledb",
        host="127.0.0.1",
        port=5434,
        database="ops_tsdb",
        username="u",
        password_encrypted=encrypt_credential("p"),
    )
    db.add(row)
    db.commit()
    ds_id = row.id
    db.close()

    target_table = f"ts_metrics_{uuid.uuid4().hex[:8]}"
    payload = {
        "name": "ts-ref",
        "source_mode": "datasource",
        "source_data_source_id": str(ds_id),
        "source_table": "service_metrics",
        "source_schema": "public",
        "target_table": target_table,
    }
    with patch("app.ingestion.etl_seed.list_columns", return_value=ColumnListResponse(items=[])):
        create = client.post("/api/v1/ingestion/sync-jobs", json=payload, headers=auth_headers)
    assert create.status_code == 201, create.text
    body = create.json()
    assert body["source"]["schema"] == "public"
    assert body["source"]["database"] == "ops_tsdb"
    assert body["source"]["table"] == "service_metrics"

    updated = {**payload, "name": "ts-ref-updated", "source_schema": "public"}
    with patch("app.ingestion.etl_seed.list_columns", return_value=ColumnListResponse(items=[])):
        put = client.put(
            f"/api/v1/ingestion/sync-jobs/{body['id']}",
            json=updated,
            headers=auth_headers,
        )
    assert put.status_code == 200, put.text
    assert put.json()["source"]["schema"] == "public"
    client.delete(f"/api/v1/ingestion/sync-jobs/{body['id']}", headers=auth_headers)


def test_create_incremental_job_missing_pk_422(client, auth_headers, job_payload):
    bad = {
        **job_payload,
        "sync_mode": "incremental",
        "incremental_column": "updated_at",
    }
    response = client.post("/api/v1/ingestion/sync-jobs", json=bad, headers=auth_headers)
    assert response.status_code == 422


def test_openapi_sync_run_item_required_fields(client):
    """T-D01-25: SyncRunItem.required 含 id,status,started_at,trace_id；paths 含 runs GET。"""
    spec = client.get("/openapi.json").json()
    required = set(spec["components"]["schemas"]["SyncRunItem"]["required"])
    assert {"id", "status", "started_at", "trace_id"}.issubset(required)
    runs_path = next(
        p for p in spec["paths"] if p.endswith("/sync-jobs/{job_id}/runs")
    )
    assert "get" in spec["paths"][runs_path]
