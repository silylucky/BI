"""官方示例 Dataset seed 幂等与删除保护。"""

from __future__ import annotations

import os

import pytest
from sqlalchemy import select, text

from app.core.config import get_settings
from app.datasources.models import Base, get_meta_engine, get_meta_session
from app.metadata.dataset.demo_bindings import ensure_demo_dataset_bindings
from app.metadata.dataset.demo_seed import DEMO_DATASET_IDS, seed_demo_datasets
from app.metadata.dataset.models import DatasetRecord

_DEMO_DS_SQLITE = "sqlite+pysqlite:///file:demo_ds_seed?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def demo_ds_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _DEMO_DS_SQLITE
    get_settings.cache_clear()
    from app.auth.models import get_meta_engine as auth_get_meta_engine

    get_meta_engine.cache_clear()
    auth_get_meta_engine.cache_clear()
    engine = get_meta_engine()
    import app.query.config_store.models  # noqa: F401

    Base.metadata.create_all(engine)
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM datasets"))
    yield
    if previous is None:
        os.environ.pop("DATABASE_URL", None)
    else:
        os.environ["DATABASE_URL"] = previous
    get_settings.cache_clear()
    get_meta_engine.cache_clear()
    auth_get_meta_engine.cache_clear()


@pytest.fixture
def db_session():
    session = get_meta_session()
    try:
        yield session
        session.rollback()
        session.execute(text("DELETE FROM datasets"))
        session.commit()
    finally:
        session.close()


def test_seed_demo_datasets_idempotent(db_session) -> None:
    first = seed_demo_datasets(db_session)
    assert first == len(DEMO_DATASET_IDS)

    ids = db_session.scalars(select(DatasetRecord.dataset_id)).all()
    assert set(ids) == set(DEMO_DATASET_IDS)

    names = db_session.scalars(select(DatasetRecord.display_name)).all()
    assert all(name.startswith("【官方示例】") for name in names)

    second = seed_demo_datasets(db_session)
    assert second == 0


def test_seed_demo_datasets_prunes_retired_ids(db_session) -> None:
    db_session.add(
        DatasetRecord(
            dataset_id="demo-gov-hotwords",
            display_name="【官方示例】政务热词",
            tables=[{"name": "gov_hotwords"}],
            computed_fields=[],
            allowed_roles=["analyst"],
        ),
    )
    db_session.commit()
    seed_demo_datasets(db_session)
    leftover = db_session.get(DatasetRecord, "demo-gov-hotwords")
    assert leftover is None
    assert db_session.get(DatasetRecord, "demo-sales-wide") is not None


def test_remap_retired_demo_dataset_in_layout() -> None:
    from app.metadata.dataset.demo_seed import remap_retired_demo_datasets_in_layout

    layout = {
        "widgets": [
            {
                "type": "chart",
                "chartConfig": {
                    "datasetId": "demo-gov-hotwords",
                    "dimensions": [{"field": "word"}],
                    "metrics": [{"field": "weight"}],
                    "axes": {"xAxis": [{"field": "word"}], "yAxis": [{"field": "weight"}]},
                },
            }
        ]
    }
    next_layout = remap_retired_demo_datasets_in_layout(layout)
    cfg = next_layout["widgets"][0]["chartConfig"]
    assert cfg["datasetId"] == "demo-sales-wide"
    assert cfg["dimensions"][0]["field"] == "product_name"
    assert cfg["metrics"][0]["field"] == "amount"
    assert cfg["axes"]["xAxis"][0]["field"] == "product_name"


def test_demo_dataset_delete_protected(client, auth_headers, db_session) -> None:
    seed_demo_datasets(db_session)

    res = client.delete("/api/v1/datasets/demo-sales-wide", headers=auth_headers)
    assert res.status_code == 409
    assert res.json()["code"] == "META_DATASET_DEMO_PROTECTED"


def test_demo_dataset_update_protected(client, auth_headers, db_session) -> None:
    seed_demo_datasets(db_session)

    res = client.put(
        "/api/v1/datasets/demo-sales-detail",
        headers=auth_headers,
        json={
            "datasetId": "demo-sales-detail",
            "displayName": "【官方示例】销售明细（改）",
            "tables": [{"name": "sales"}],
            "computedFields": [],
            "allowedRoles": ["analyst"],
        },
    )
    assert res.status_code == 409
    assert res.json()["code"] == "META_DATASET_DEMO_PROTECTED"


def test_dataset_list_marks_demo_package(client, auth_headers, db_session) -> None:
    seed_demo_datasets(db_session)

    res = client.get("/api/v1/datasets", headers=auth_headers)
    assert res.status_code == 200
    demo_items = [item for item in res.json()["items"] if item["datasetId"].startswith("demo-")]
    assert len(demo_items) == len(DEMO_DATASET_IDS)
    assert all(item["isDemoPackage"] is True for item in demo_items)


def test_ensure_demo_dataset_bindings_idempotent(db_session) -> None:
    import uuid

    from app.datasources.models import DataSource
    from app.dashboard.templates.demo_datasource import OFFICIAL_DEMO_DATASOURCE_CODE
    from app.query.config_store.models import QueryConfigRecord

    ds_id = uuid.uuid4()
    db_session.add(
        DataSource(
            id=ds_id,
            name="示例数据",
            code=OFFICIAL_DEMO_DATASOURCE_CODE,
            type="mysql",
            host="127.0.0.1",
            port=3307,
            database="sample_db",
            username="sample",
            password_encrypted="enc",
        ),
    )
    db_session.commit()

    seed_demo_datasets(db_session)
    first = ensure_demo_dataset_bindings(db_session)
    assert first == len(DEMO_DATASET_IDS)

    rows = db_session.scalars(
        select(DatasetRecord).where(DatasetRecord.dataset_id.in_(DEMO_DATASET_IDS)),
    ).all()
    assert all(row.bound_config_id is not None for row in rows)

    config_count = db_session.scalar(
        select(QueryConfigRecord.id).where(QueryConfigRecord.config_type == "dataset_query"),
    )
    assert config_count is not None

    second = ensure_demo_dataset_bindings(db_session)
    assert second == 0


def test_ensure_demo_dataset_bindings_repairs_stale_payload(db_session) -> None:
    import uuid

    from app.datasources.models import DataSource
    from app.dashboard.templates.demo_datasource import OFFICIAL_DEMO_DATASOURCE_CODE
    from app.query.config_store.models import QueryConfigRecord

    demo_ds_id = uuid.uuid4()
    stale_ds_id = uuid.uuid4()
    db_session.add(
        DataSource(
            id=demo_ds_id,
            name="示例数据",
            code=OFFICIAL_DEMO_DATASOURCE_CODE,
            type="mysql",
            host="127.0.0.1",
            port=3307,
            database="sample_db",
            username="sample",
            password_encrypted="enc",
        ),
    )
    db_session.add(
        DataSource(
            id=stale_ds_id,
            name="托管分析库",
            code="analytics",
            type="postgresql",
            host="127.0.0.1",
            port=5433,
            database="analytics",
            username="vitalspan",
            password_encrypted="enc",
        ),
    )
    db_session.commit()

    seed_demo_datasets(db_session)
    ensure_demo_dataset_bindings(db_session)

    row = db_session.get(DatasetRecord, "demo-sales-wide")
    assert row is not None and row.bound_config_id is not None
    record = db_session.get(QueryConfigRecord, row.bound_config_id)
    assert record is not None
    record.payload = {
        **record.payload,
        "dataSourceId": str(stale_ds_id),
        "connectorType": "postgresql",
        "schema": "",
        "table": "de_sales_wide",
    }
    record.revision += 1
    db_session.commit()

    repaired = ensure_demo_dataset_bindings(db_session)
    assert repaired >= 1

    from app.dashboard.templates.demo_datasource import resolve_sample_db_datasource_id

    expected_ds = resolve_sample_db_datasource_id(db_session)
    assert expected_ds is not None
    db_session.refresh(record)
    assert record.payload["dataSourceId"] == str(expected_ds)
    assert record.payload["connectorType"] == "mysql"
    assert record.payload["schema"] == "sample_db"
