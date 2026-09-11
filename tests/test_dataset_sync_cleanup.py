"""Dataset 与同步任务级联清理单测。"""

import os
import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///file:dataset_cleanup?mode=memory&cache=shared&uri=true"
os.environ.setdefault(
    "ANALYTICS_DATABASE_URL",
    "postgresql+psycopg://vitalspan:vitalspan@localhost:5433/analytics",
)

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, text

from app.core.config import get_settings
from app.core.crypto.credentials import encrypt_credential
from app.datasources.models import DataSource
from app.ingestion.models import Base, SyncJob, get_meta_engine, get_meta_session
from app.main import app
from app.metadata.dataset.cleanup import _stable_ref_id
from app.metadata.dataset.models import DatasetRecord
from app.query.config_store.models import QueryConfigRecord

get_settings.cache_clear()
get_meta_engine.cache_clear()


@pytest.fixture(scope="module", autouse=True)
def ensure_tables():
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    import app.metadata.dataset.models  # noqa: F401
    import app.query.config_store.models  # noqa: F401
    from app.datasources.models import Base as MetaBase

    MetaBase.metadata.create_all(engine)
    yield
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM query_config_records"))
        conn.execute(text("DELETE FROM datasets"))
        conn.execute(text("DELETE FROM ingestion_sync_jobs"))
        conn.execute(text("DELETE FROM data_sources"))


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def _seed_mysql_datasource() -> uuid.UUID:
    db = get_meta_session()
    suffix = uuid.uuid4().hex[:8]
    row = DataSource(
        name=f"cleanup-mysql-{suffix}",
        code=f"cleanup_mysql_{suffix}",
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
    db.close()
    return ds_id


def test_list_datasets_purges_orphan_sync_job_dataset(client, auth_headers):
    dataset_id = f"orphan_{uuid.uuid4().hex[:8]}"
    job_id = uuid.uuid4()
    db = get_meta_session()
    db.add(
        DatasetRecord(
            dataset_id=dataset_id,
            display_name="孤儿同步产物",
            tables=[{"name": f"public.{dataset_id}"}],
            computed_fields=[],
            allowed_roles=["analyst"],
            origin="sync_job",
            sync_job_id=job_id,
        ),
    )
    db.commit()
    db.close()

    listed = client.get("/api/v1/datasets", headers=auth_headers)
    assert listed.status_code == 200
    ids = [item["datasetId"] for item in listed.json()["items"]]
    assert dataset_id not in ids

    detail = client.get(f"/api/v1/datasets/{dataset_id}", headers=auth_headers)
    assert detail.status_code == 404


def test_list_datasets_flags_missing_source_health(client, auth_headers):
    dataset_id = f"stale_{uuid.uuid4().hex[:8]}"
    db = get_meta_session()
    ds_row = DataSource(
        name="gone-ds",
        code=f"gone_ds_{uuid.uuid4().hex[:8]}",
        type="mysql",
        host="127.0.0.1",
        port=3307,
        database="sample_db",
        username="sample",
        password_encrypted=encrypt_credential("sample"),
        deleted_at=datetime.now(UTC),
    )
    db.add(ds_row)
    db.flush()
    db.add(
        DatasetRecord(
            dataset_id=dataset_id,
            display_name="源已删的手动 Dataset",
            tables=[{"name": "sample_db.orders"}],
            computed_fields=[],
            allowed_roles=["analyst"],
            origin="manual",
            table_source_datasource_id=ds_row.id,
        ),
    )
    db.commit()
    db.close()

    listed = client.get("/api/v1/datasets", headers=auth_headers)
    assert listed.status_code == 200
    item = next((i for i in listed.json()["items"] if i["datasetId"] == dataset_id), None)
    assert item is not None
    assert item["sourceHealth"] == "missing"

    client.delete(f"/api/v1/datasets/{dataset_id}", headers=auth_headers)


def test_sync_job_lists_missing_source_health(client, auth_headers):
    ds_id = _seed_mysql_datasource()
    target = f"stale_job_{uuid.uuid4().hex[:8]}"
    create = client.post(
        "/api/v1/ingestion/sync-jobs",
        json={
            "name": "stale-source-job",
            "source_mode": "datasource",
            "source_data_source_id": str(ds_id),
            "source_table": "dirty_orders",
            "target_table": target,
            "schedule_cron": None,
        },
        headers=auth_headers,
    )
    assert create.status_code == 201, create.text
    job_id = create.json()["id"]

    db = get_meta_session()
    row = db.get(DataSource, ds_id)
    row.deleted_at = datetime.now(UTC)
    db.commit()
    db.close()

    listed = client.get("/api/v1/ingestion/sync-jobs", headers=auth_headers)
    assert listed.status_code == 200
    item = next((i for i in listed.json()["items"] if i["id"] == job_id), None)
    assert item is not None
    assert item["source_health"] == "missing"

    client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)


def test_delete_sync_job_cascades_bound_dataset_and_config(client, auth_headers):
    mysql_datasource_id = _seed_mysql_datasource()
    target = f"cascade_{uuid.uuid4().hex[:8]}"
    payload = {
        "name": "cascade-job",
        "source_mode": "datasource",
        "source_data_source_id": str(mysql_datasource_id),
        "source_table": "dirty_orders",
        "target_table": target,
        "schedule_cron": None,
    }
    create = client.post("/api/v1/ingestion/sync-jobs", json=payload, headers=auth_headers)
    assert create.status_code == 201, create.text
    job_id = create.json()["id"]
    analytics_id = uuid.uuid4()
    mock_columns = MagicMock()
    mock_columns.items = [SimpleNamespace(name="id"), SimpleNamespace(name="amount")]

    with (
        patch("app.ingestion.sync_consume.ensure_analytics_datasource", return_value=analytics_id),
        patch("app.ingestion.sync_consume.can_connect_analytics_pg", return_value=True),
        patch("app.ingestion.sync_consume.list_columns", return_value=mock_columns),
    ):
        ensured = client.post(
            f"/api/v1/ingestion/sync-jobs/{job_id}/ensure-dataset",
            headers=auth_headers,
        )
    assert ensured.status_code == 200, ensured.text
    bound_config_id = uuid.UUID(ensured.json()["boundConfigId"])
    stable_ref = _stable_ref_id(target)

    with patch("app.ingestion.sync_write.drop_analytics_table", return_value=True):
        deleted = client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)
    assert deleted.status_code == 204, deleted.text
    assert client.get(f"/api/v1/datasets/{target}", headers=auth_headers).status_code == 404

    db = get_meta_session()
    assert db.get(SyncJob, uuid.UUID(job_id)) is None
    assert db.get(DatasetRecord, target) is None
    assert db.get(QueryConfigRecord, bound_config_id) is None
    assert db.scalar(
        select(QueryConfigRecord).where(QueryConfigRecord.ref_id == stable_ref).limit(1),
    ) is None
    db.close()


def test_delete_sync_job_returns_503_when_analytics_drop_fails(client, auth_headers):
    mysql_datasource_id = _seed_mysql_datasource()
    target = f"dropfail_{uuid.uuid4().hex[:8]}"
    create = client.post(
        "/api/v1/ingestion/sync-jobs",
        json={
            "name": "drop-fail-job",
            "source_mode": "datasource",
            "source_data_source_id": str(mysql_datasource_id),
            "source_table": "dirty_orders",
            "target_table": target,
            "schedule_cron": None,
        },
        headers=auth_headers,
    )
    assert create.status_code == 201, create.text
    job_id = create.json()["id"]

    with patch("app.ingestion.sync_write.drop_analytics_table", return_value=False):
        deleted = client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)

    assert deleted.status_code == 503
    assert deleted.json()["detail"]["code"] == "SYNC_ANALYTICS_TABLE_DROP_FAILED"
    assert client.get(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers).status_code == 200

    with patch("app.ingestion.sync_write.drop_analytics_table", return_value=True):
        cleanup = client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)
    assert cleanup.status_code == 204, cleanup.text


def test_delete_dataset_removes_bound_query_config(client, auth_headers):
    dataset_id = f"delcfg_{uuid.uuid4().hex[:8]}"
    ds_id = _seed_mysql_datasource()
    config_id = uuid.uuid4()
    stable_ref = _stable_ref_id(dataset_id)
    db = get_meta_session()
    db.add(
        QueryConfigRecord(
            id=config_id,
            config_type="dataset_query",
            schema_version="1.0",
            ref_type="dataset",
            ref_id=stable_ref,
            payload={
                "dataSourceId": str(ds_id),
                "connectorType": "mysql",
                "schema": "sample_db",
                "table": "orders",
                "columns": ["id"],
                "conditions": {"logic": "AND", "conditions": []},
                "limit": 1000,
                "offset": 0,
            },
        ),
    )
    db.add(
        DatasetRecord(
            dataset_id=dataset_id,
            display_name="待删 Dataset",
            tables=[{"name": "sample_db.orders"}],
            computed_fields=[],
            allowed_roles=["analyst"],
            origin="manual",
            table_source_datasource_id=ds_id,
            bound_config_id=config_id,
        ),
    )
    db.commit()
    db.close()

    resp = client.delete(f"/api/v1/datasets/{dataset_id}", headers=auth_headers)
    assert resp.status_code == 204

    db = get_meta_session()
    assert db.get(DatasetRecord, dataset_id) is None
    assert db.get(QueryConfigRecord, config_id) is None
    assert db.scalar(
        select(QueryConfigRecord).where(QueryConfigRecord.ref_id == stable_ref).limit(1),
    ) is None
    db.close()


def test_delete_datasource_blocked_when_sync_job_references(client, auth_headers):
    ds_id = _seed_mysql_datasource()
    payload = {
        "name": "block-delete-job",
        "source_mode": "datasource",
        "source_data_source_id": str(ds_id),
        "source_table": "dirty_orders",
        "target_table": f"blk_{uuid.uuid4().hex[:8]}",
        "schedule_cron": None,
    }
    create = client.post("/api/v1/ingestion/sync-jobs", json=payload, headers=auth_headers)
    assert create.status_code == 201, create.text
    job_id = create.json()["id"]

    blocked = client.delete(f"/api/v1/datasources/{ds_id}", headers=auth_headers)
    assert blocked.status_code == 409
    assert blocked.json()["code"] == "DATASOURCE_IN_USE"

    client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)


def test_delete_datasource_blocked_when_dataset_references(client, auth_headers):
    ds_id = _seed_mysql_datasource()
    dataset_id = f"refds_{uuid.uuid4().hex[:8]}"
    create_ds = client.post(
        "/api/v1/datasets",
        json={
            "datasetId": dataset_id,
            "displayName": "引用数据源",
            "tables": [{"name": "sample_db.orders"}],
            "tableSourceDataSourceId": str(ds_id),
        },
        headers=auth_headers,
    )
    assert create_ds.status_code == 201, create_ds.text

    blocked = client.delete(f"/api/v1/datasources/{ds_id}", headers=auth_headers)
    assert blocked.status_code == 409
    assert blocked.json()["code"] == "DATASOURCE_IN_USE"

    assert client.delete(f"/api/v1/datasets/{dataset_id}", headers=auth_headers).status_code == 204
    assert client.delete(f"/api/v1/datasources/{ds_id}", headers=auth_headers).status_code == 204


def test_delete_datasource_blocked_when_bound_config_references(client, auth_headers):
    ds_id = _seed_mysql_datasource()
    config_id = uuid.uuid4()
    dataset_id = f"boundcfg_{uuid.uuid4().hex[:8]}"
    db = get_meta_session()
    db.add(
        QueryConfigRecord(
            id=config_id,
            config_type="dataset_query",
            schema_version="1.0",
            ref_type="dataset",
            ref_id=_stable_ref_id(dataset_id),
            payload={"dataSourceId": str(ds_id), "schema": "public", "table": "orders"},
            revision=1,
        ),
    )
    db.add(
        DatasetRecord(
            dataset_id=dataset_id,
            display_name="绑定 query config",
            tables=[{"name": "public.orders"}],
            computed_fields=[],
            allowed_roles=["analyst"],
            bound_config_id=config_id,
        ),
    )
    db.commit()
    db.close()

    blocked = client.delete(f"/api/v1/datasources/{ds_id}", headers=auth_headers)
    assert blocked.status_code == 409
    assert blocked.json()["code"] == "DATASOURCE_IN_USE"

    client.delete(f"/api/v1/datasets/{dataset_id}", headers=auth_headers)


def test_trigger_run_blocked_when_source_missing(client, auth_headers):
    ds_id = _seed_mysql_datasource()
    target = f"norun_{uuid.uuid4().hex[:8]}"
    create = client.post(
        "/api/v1/ingestion/sync-jobs",
        json={
            "name": "missing-source-run",
            "source_mode": "datasource",
            "source_data_source_id": str(ds_id),
            "source_table": "dirty_orders",
            "target_table": target,
            "schedule_cron": None,
        },
        headers=auth_headers,
    )
    assert create.status_code == 201, create.text
    job_id = create.json()["id"]

    db = get_meta_session()
    row = db.get(DataSource, ds_id)
    row.deleted_at = datetime.now(UTC)
    db.commit()
    db.close()

    blocked = client.post(f"/api/v1/ingestion/sync-jobs/{job_id}/run", headers=auth_headers)
    assert blocked.status_code == 409
    assert blocked.json()["detail"]["code"] == "SYNC_SOURCE_UNAVAILABLE"

    client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)


def test_delete_sync_job_blocked_when_run_in_progress(client, auth_headers):
    ds_id = _seed_mysql_datasource()
    target = f"delrun_{uuid.uuid4().hex[:8]}"
    create = client.post(
        "/api/v1/ingestion/sync-jobs",
        json={
            "name": "running-delete-block",
            "source_mode": "datasource",
            "source_data_source_id": str(ds_id),
            "source_table": "dirty_orders",
            "target_table": target,
            "schedule_cron": None,
        },
        headers=auth_headers,
    )
    assert create.status_code == 201, create.text
    job_id = uuid.UUID(create.json()["id"])

    db = get_meta_session()
    from app.ingestion.models import SyncRun

    db.add(SyncRun(job_id=job_id, status="running", trace_id="in-progress"))
    db.commit()
    db.close()

    blocked = client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)
    assert blocked.status_code == 409
    assert blocked.json()["detail"]["code"] == "SYNC_JOB_RUN_IN_PROGRESS"
