"""官方演示包 API 与 seed 闭环验收。"""

from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, text

from app.core.config import get_settings
from app.dashboard.demo_instances.seed import DEMO_INSTANCE_SLUGS, seed_demo_instances
from app.dashboard.templates.demo_datasource import (
    DEMO_DATASOURCE_NAME,
    OFFICIAL_DEMO_DATASOURCE_CODE,
    ensure_official_demo_datasource,
)
from app.dashboard.templates.seed import seed_builtin_dashboard_templates
from app.datasources.models import Base, DataSource, get_meta_engine, get_meta_session

_DEMO_PKG_SQLITE = "sqlite+pysqlite:///file:demo_pkg_api?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def demo_pkg_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _DEMO_PKG_SQLITE
    get_settings.cache_clear()
    from app.auth.models import get_meta_engine as auth_get_meta_engine

    get_meta_engine.cache_clear()
    auth_get_meta_engine.cache_clear()
    engine = get_meta_engine()
    from app.dashboard.models import Dashboard  # noqa: F401
    from app.dashboard.templates.models import DashboardTemplate  # noqa: F401

    Base.metadata.create_all(engine)
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM dashboards"))
        conn.execute(text("DELETE FROM dashboard_templates"))
        conn.execute(text("DELETE FROM data_sources"))
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
        session.execute(text("DELETE FROM dashboards"))
        session.execute(text("DELETE FROM dashboard_templates"))
        session.execute(text("DELETE FROM data_sources"))
        session.commit()
    finally:
        session.close()


def test_demo_package_status_requires_auth(client: TestClient) -> None:
    res = client.get("/api/v1/demo-package/status")
    assert res.status_code == 401
    assert res.json()["code"] == "UNAUTHORIZED"


def test_demo_package_status_response_shape(
    client: TestClient,
    auth_headers: dict,
    db_session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.dashboard.demo_package import status as demo_status
    from app.dashboard.templates.official_demo_bootstrap import SchemaBootstrapResult

    ds_id = uuid.uuid4()
    dash_id = uuid.uuid4()
    monkeypatch.setattr(
        demo_status,
        "probe_sample_db_schema",
        lambda: SchemaBootstrapResult(
            mysql_reachable=True,
            schema_version=4,
            applied_count=0,
        ),
    )
    monkeypatch.setattr(
        demo_status,
        "resolve_sample_db_datasource_id",
        lambda _db: ds_id,
    )
    monkeypatch.setattr(
        demo_status,
        "resolve_demo_instance_ids",
        lambda _db: [dash_id, dash_id, dash_id],
    )
    monkeypatch.setattr(
        demo_status,
        "resolve_demo_dataset_ids",
        lambda _db: ["demo-sales-wide", "demo-sales-detail", "demo-v-sales-geo", "demo-gov-grid-stats"],
    )

    res = client.get("/api/v1/demo-package/status", headers=auth_headers)
    assert res.status_code == 200
    body = res.json()
    assert body["ready"] is True
    assert body["mysqlReachable"] is True
    assert body["schemaVersion"] == 4
    assert body["datasourceId"] == str(ds_id)
    assert body["datasourceCode"] == "demo"
    assert len(body["demoDashboardIds"]) == 3
    assert len(body["demoDatasetIds"]) == 4
    assert body["message"] is None


def test_demo_datasource_delete_protected(client: TestClient, auth_headers: dict, db_session) -> None:
    row = DataSource(
        name=DEMO_DATASOURCE_NAME,
        code=OFFICIAL_DEMO_DATASOURCE_CODE,
        type="mysql",
        host="127.0.0.1",
        port=3307,
        database="sample_db",
        username="sample",
        password_encrypted="enc",
    )
    db_session.add(row)
    db_session.commit()
    db_session.refresh(row)

    res = client.delete(f"/api/v1/datasources/{row.id}", headers=auth_headers)
    assert res.status_code == 409
    assert res.json()["code"] == "DATASOURCE_DEMO_PROTECTED"


def test_datasource_list_exposes_is_demo_package(
    client: TestClient,
    auth_headers: dict,
    db_session,
) -> None:
    row = DataSource(
        name=DEMO_DATASOURCE_NAME,
        code=OFFICIAL_DEMO_DATASOURCE_CODE,
        type="mysql",
        host="127.0.0.1",
        port=3307,
        database="sample_db",
        username="sample",
        password_encrypted="enc",
    )
    db_session.add(row)
    db_session.commit()

    res = client.get("/api/v1/datasources", headers=auth_headers)
    assert res.status_code == 200
    demo_items = [item for item in res.json()["items"] if item["code"] == "demo"]
    assert len(demo_items) == 1
    assert demo_items[0]["isDemoPackage"] is True


def test_seed_demo_instances_idempotent(db_session, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.dashboard.models import Dashboard

    demo_ds = uuid.uuid4()
    monkeypatch.setattr(
        "app.dashboard.demo_instances.seed.resolve_sample_db_datasource_id",
        lambda _db: demo_ds,
    )

    seed_builtin_dashboard_templates(db_session)
    first = seed_demo_instances(db_session)
    assert first == 3

    slugs = db_session.scalars(
        select(Dashboard.slug).where(Dashboard.deleted_at.is_(None)),
    ).all()
    assert set(slugs) == set(DEMO_INSTANCE_SLUGS)

    second = seed_demo_instances(db_session)
    assert second == 0
    assert db_session.scalar(
        select(Dashboard).where(Dashboard.slug == "官方示例-双栏指标看板"),
    ).name.startswith("官方示例")


def test_openapi_includes_demo_package_status(client: TestClient) -> None:
    res = client.get("/openapi.json")
    assert res.status_code == 200
    assert "/api/v1/demo-package/status" in res.json()["paths"]
