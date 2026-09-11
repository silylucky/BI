"""T1 Dataset ORM persistence + real execute path (FAKE-01 / FAKE-02)."""
from __future__ import annotations

import os
import uuid
from collections.abc import Generator
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.auth.deps import UserContext, get_current_user
from app.core.config import get_settings
from app.main import app as fastapi_app
from app.query.executor import QueryExecutor, QueryResult
from jwt_auth import AUTH

_SQLITE_URL = "sqlite+pysqlite:///file:t1_dataset_orm?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def t1_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _SQLITE_URL
    get_settings.cache_clear()
    from app.auth.models import Base as AuthBase, get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    from app.query.models import Base as QueryBase
    import app.auth.models  # noqa: F401
    import app.dashboard.models  # noqa: F401
    import app.datasources.models  # noqa: F401
    import app.metadata.dataset.models  # noqa: F401
    import app.query.config_store.models  # noqa: F401
    import app.query.models  # noqa: F401

    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    AuthBase.metadata.create_all(engine)
    QueryBase.metadata.create_all(engine)
    yield
    if previous is None:
        os.environ.pop("DATABASE_URL", None)
    else:
        os.environ["DATABASE_URL"] = previous
    get_settings.cache_clear()
    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    fastapi_app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def clear_datasets():
    from app.metadata.dataset import service as dataset_service

    dataset_service._store.clear()
    yield
    dataset_service._store.clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(fastapi_app)


@pytest.fixture
def admin_actor() -> Generator[None, None, None]:
    fastapi_app.dependency_overrides[get_current_user] = lambda: UserContext(
        id=str(uuid.uuid4()), username="admin", roles=["admin"],
    )
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


def test_t1_dataset_create_survives_session_restart(client, admin_actor):
    """FAKE-01: create → new meta session (sim restart) → still GET 200."""
    ds_id = f"ds-{uuid.uuid4().hex[:8]}"
    create = client.post(
        "/api/v1/datasets",
        headers=AUTH,
        json={
            "datasetId": ds_id,
            "displayName": "持久化",
            "tables": [{"name": "orders"}],
            "computedFields": [{"name": "amt2", "expression": "amount * 2"}],
            "allowedRoles": ["analyst"],
        },
    )
    assert create.status_code == 201, create.text

    from app.datasources.models import get_meta_engine, get_meta_session

    get_meta_engine.cache_clear()
    session = get_meta_session()
    try:
        from app.metadata.dataset.models import DatasetRecord

        row = session.get(DatasetRecord, ds_id)
        assert row is not None
        assert row.display_name == "持久化"
        assert row.tables[0]["name"] == "orders"
    finally:
        session.close()

    resp = client.get(f"/api/v1/datasets/{ds_id}", headers=AUTH)
    assert resp.status_code == 200
    body = resp.json()
    assert body["displayName"] == "持久化"
    assert body["computedFields"][0]["name"] == "amt2"


def test_t1_dataset_crud_roundtrip(client, admin_actor):
    """CRUD: create → list → update → delete → 404."""
    ds_id = f"ds-{uuid.uuid4().hex[:8]}"
    assert client.post(
        "/api/v1/datasets",
        headers=AUTH,
        json={"datasetId": ds_id, "displayName": "A", "tables": [{"name": "t1"}]},
    ).status_code == 201

    listed = client.get("/api/v1/datasets", headers=AUTH).json()
    assert any(i["datasetId"] == ds_id for i in listed["items"])

    upd = client.put(
        f"/api/v1/datasets/{ds_id}",
        headers=AUTH,
        json={"datasetId": ds_id, "displayName": "B", "tables": [{"name": "t2"}]},
    )
    assert upd.status_code == 200
    assert upd.json()["displayName"] == "B"
    assert upd.json()["tables"][0]["name"] == "t2"

    assert client.delete(f"/api/v1/datasets/{ds_id}", headers=AUTH).status_code == 204
    assert client.get(f"/api/v1/datasets/{ds_id}", headers=AUTH).status_code == 404


@patch.object(QueryExecutor, "execute_sql")
def test_t1_bound_dataset_execute_returns_rows(mock_exec, client, admin_actor):
    """FAKE-02: main path POST /query/dataset/execute returns real rows for bound dataset."""
    mock_exec.return_value = QueryResult(
        columns=["id", "amt2"], rows=[[1, 20]], row_count=1, truncated=False,
    )
    ds_id = f"ds-{uuid.uuid4().hex[:8]}"
    client.post(
        "/api/v1/datasets",
        headers=AUTH,
        json={
            "datasetId": ds_id,
            "displayName": "Exec",
            "tables": [{"name": "orders"}],
            "computedFields": [{"name": "amt2", "expression": "id + 1"}],
        },
    )
    ds_src = str(uuid.uuid4())
    cfg = client.put(
        "/api/v1/query/configs",
        headers=AUTH,
        json={
            "configType": "dataset_query",
            "schemaVersion": "1.0",
            "refType": "dataset",
            "refId": str(uuid.uuid4()),
            "payload": {
                "dataSourceId": ds_src,
                "connectorType": "mysql",
                "schema": "demo",
                "table": "orders",
                "columns": ["id"],
                "conditions": {"logic": "AND", "conditions": []},
                "limit": 10,
                "offset": 0,
            },
        },
    ).json()
    config_id = cfg["id"]
    bind = client.post(
        f"/api/v1/datasets/{ds_id}/bind-query-config",
        headers=AUTH,
        json={"configId": config_id},
    )
    assert bind.status_code == 200
    assert bind.json()["boundConfigId"] == config_id

    # Simulate process restart: clear engine cache; ORM row must still bind.
    from app.datasources.models import get_meta_engine

    get_meta_engine.cache_clear()

    exec_resp = client.post(
        "/api/v1/query/dataset/execute",
        headers=AUTH,
        json={"dataSourceId": ds_src, "configId": config_id},
    )
    assert exec_resp.status_code == 200, exec_resp.text
    body = exec_resp.json()
    assert body["rowCount"] >= 1
    assert body["rows"]
    mock_exec.assert_called_once()
    # Computed field augmentation should reach executor SQL
    call_kwargs = mock_exec.call_args
    sql_arg = call_kwargs.args[3] if len(call_kwargs.args) > 3 else call_kwargs.kwargs.get("sql")
    assert sql_arg is not None
    assert "amt2" in sql_arg
