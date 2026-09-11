"""M-FINAL F-D r243 — QUERY-007~009 dataset_query 存储→翻译→执行链。"""
from __future__ import annotations

import os
import uuid
from collections.abc import Generator
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.auth.deps import UserContext, get_current_user
from app.auth.models import AuthResourceGrant, AuthRole
from app.core.config import get_settings
from app.datasources.models import get_meta_session
from app.datasources.schemas import DataSourceCreate
from app.datasources.service import create_data_source
from app.main import app as fastapi_app
from app.query.config_store.models import QueryConfigRecord
from app.query.executor import QueryExecutor, QueryResult
from app.query.translator.from_config import probe_translate_from_config_budget_ms
from jwt_auth import jwt_auth_headers

_R243_SQLITE_URL = "sqlite+pysqlite:///file:mfinal_fd_r243?mode=memory&cache=shared&uri=true"
AUTH = jwt_auth_headers()
OWNER_ID = str(uuid.uuid4())
OTHER_ID = str(uuid.uuid4())


@pytest.fixture(scope="module", autouse=True)
def r243_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R243_SQLITE_URL
    get_settings.cache_clear()
    from app.auth.models import Base as AuthBase, get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    from app.query.models import Base as QueryBase
    import app.auth.models  # noqa: F401
    import app.dashboard.models  # noqa: F401
    import app.datasources.models  # noqa: F401
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


@pytest.fixture
def client() -> TestClient:
    return TestClient(fastapi_app)


@pytest.fixture
def owner_user() -> Generator[None, None, None]:
    def _override() -> UserContext:
        return UserContext(id=OWNER_ID, username="owner", roles=["analyst"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def other_user() -> Generator[None, None, None]:
    def _override() -> UserContext:
        return UserContext(id=OTHER_ID, username="other", roles=["analyst"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def admin_user() -> Generator[None, None, None]:
    def _override() -> UserContext:
        return UserContext(id=str(uuid.uuid4()), username="admin", roles=["admin"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


def _valid_dataset_query_payload(ds_id: str) -> dict:
    return {
        "dataSourceId": ds_id,
        "connectorType": "mysql",
        "schema": "demo",
        "table": "orders",
        "columns": ["order_amount", "status"],
        "conditions": {"logic": "AND", "conditions": []},
        "limit": 100,
        "offset": 0,
    }


def test_query_r243_007_01_put_dataset_query_ok(client, owner_user):
    """T-QUERY-R243-007-01: PUT dataset_query 合法 payload → 200 + revision=1。"""
    ds_id = str(uuid.uuid4())
    body = {
        "configType": "dataset_query",
        "schemaVersion": "1.0",
        "refType": "dataset",
        "refId": str(uuid.uuid4()),
        "payload": _valid_dataset_query_payload(ds_id),
    }
    resp = client.put("/api/v1/query/configs", headers=AUTH, json=body)
    assert resp.status_code == 200
    assert resp.json()["revision"] == 1
    assert resp.json()["configType"] == "dataset_query"


def test_query_r243_007_02_missing_data_source_id(client, owner_user):
    """T-QUERY-R243-007-02: PUT 缺 dataSourceId → 422 CONFIG_INVALID_DATASET_QUERY。"""
    payload = _valid_dataset_query_payload(str(uuid.uuid4()))
    del payload["dataSourceId"]
    body = {
        "configType": "dataset_query",
        "schemaVersion": "1.0",
        "refType": "dataset",
        "refId": str(uuid.uuid4()),
        "payload": payload,
    }
    resp = client.put("/api/v1/query/configs", headers=AUTH, json=body)
    assert resp.status_code == 422
    assert resp.json()["code"] == "CONFIG_INVALID_DATASET_QUERY"


def test_query_r243_007_03_viewer_get_other_owner_forbidden(client, owner_user):
    """T-QUERY-R243-007-03: 非 owner 非 admin GET 他人记录 → 403。"""
    body = {
        "configType": "dataset_query",
        "schemaVersion": "1.0",
        "refType": "dataset",
        "refId": str(uuid.uuid4()),
        "payload": _valid_dataset_query_payload(str(uuid.uuid4())),
    }
    put = client.put("/api/v1/query/configs", headers=AUTH, json=body)
    config_id = put.json()["id"]
    fastapi_app.dependency_overrides[get_current_user] = (
        lambda: UserContext(id=OTHER_ID, username="other", roles=["analyst"])
    )
    get_resp = client.get(f"/api/v1/query/configs/{config_id}", headers=AUTH)
    assert get_resp.status_code == 403
    assert get_resp.json()["code"] == "CONFIG_ACCESS_FORBIDDEN"


def test_query_r243_007_04_admin_get_other_owner_ok(client, owner_user):
    """T-QUERY-R243-007-04: admin GET 他人记录 → 200。"""
    body = {
        "configType": "dataset_query",
        "schemaVersion": "1.0",
        "refType": "dataset",
        "refId": str(uuid.uuid4()),
        "payload": _valid_dataset_query_payload(str(uuid.uuid4())),
    }
    put = client.put("/api/v1/query/configs", headers=AUTH, json=body)
    config_id = put.json()["id"]
    fastapi_app.dependency_overrides[get_current_user] = (
        lambda: UserContext(id=str(uuid.uuid4()), username="admin", roles=["admin"])
    )
    get_resp = client.get(f"/api/v1/query/configs/{config_id}", headers=AUTH)
    assert get_resp.status_code == 200


def test_query_r243_007_05_payload_256kb_regression(client, owner_user):
    """T-QUERY-R243-007-05: dataset_query payload 256KB 边界仍走 CONFIG_PAYLOAD_TOO_LARGE（r33 回归）。"""
    chunk = "x" * 1024
    oversized = {"data": [chunk for _ in range(260)]}
    oversized.update(_valid_dataset_query_payload(str(uuid.uuid4())))
    body = {
        "configType": "dataset_query",
        "schemaVersion": "1.0",
        "refType": "dataset",
        "refId": str(uuid.uuid4()),
        "payload": oversized,
    }
    resp = client.put("/api/v1/query/configs", headers=AUTH, json=body)
    assert resp.status_code == 413
    assert resp.json()["code"] == "CONFIG_PAYLOAD_TOO_LARGE"


def _put_mysql_dataset_query(client) -> tuple[str, str]:
    ds_id = str(uuid.uuid4())
    body = {
        "configType": "dataset_query",
        "schemaVersion": "1.0",
        "refType": "dataset",
        "refId": str(uuid.uuid4()),
        "payload": _valid_dataset_query_payload(ds_id),
    }
    put = client.put("/api/v1/query/configs", headers=AUTH, json=body)
    assert put.status_code == 200
    return put.json()["id"], ds_id


def test_query_r243_008_01_translate_mysql_backticks(client, owner_user):
    """T-QUERY-R243-008-01: 存 mysql dataset_query → translate → SQL 含反引号 + %(p0)s。"""
    ds_id = str(uuid.uuid4())
    payload = _valid_dataset_query_payload(ds_id)
    payload["conditions"] = {
        "logic": "AND",
        "conditions": [{"fieldId": "status", "operator": "eq", "value": "ok"}],
    }
    body = {
        "configType": "dataset_query",
        "schemaVersion": "1.0",
        "refType": "dataset",
        "refId": str(uuid.uuid4()),
        "payload": payload,
    }
    put = client.put("/api/v1/query/configs", headers=AUTH, json=body)
    assert put.status_code == 200
    config_id = put.json()["id"]
    resp = client.post(f"/api/v1/query/configs/{config_id}/translate", headers=AUTH)
    assert resp.status_code == 200
    body = resp.json()
    assert "`" in body["sql"]
    assert "%(p" in body["sql"] or body["parameters"]


def test_query_r243_008_02_invalid_operator(client, owner_user):
    """T-QUERY-R243-008-02: 非法 operator → 422 QUERY_TRANSLATE_INVALID_OPERATOR。"""
    ds_id = str(uuid.uuid4())
    payload = _valid_dataset_query_payload(ds_id)
    payload["conditions"] = {
        "logic": "AND",
        "conditions": [{"fieldId": "status", "operator": "not_in", "value": "x"}],
    }
    body = {
        "configType": "dataset_query",
        "schemaVersion": "1.0",
        "refType": "dataset",
        "refId": str(uuid.uuid4()),
        "payload": payload,
    }
    put = client.put("/api/v1/query/configs", headers=AUTH, json=body)
    config_id = put.json()["id"]
    resp = client.post(f"/api/v1/query/configs/{config_id}/translate", headers=AUTH)
    assert resp.status_code == 422
    assert resp.json()["code"] == "QUERY_TRANSLATE_INVALID_OPERATOR"


def test_query_r243_008_03_wrong_config_type(client, owner_user):
    """T-QUERY-R243-008-03: configType=query_conditions → 422 QUERY_TRANSLATE_INVALID_CONFIG。"""
    body = {
        "configType": "query_conditions",
        "schemaVersion": "1.0",
        "refType": "design_draft",
        "refId": str(uuid.uuid4()),
        "payload": {"logic": "AND", "conditions": []},
    }
    put = client.put("/api/v1/query/configs", headers=AUTH, json=body)
    config_id = put.json()["id"]
    resp = client.post(f"/api/v1/query/configs/{config_id}/translate", headers=AUTH)
    assert resp.status_code == 422
    assert resp.json()["code"] == "QUERY_TRANSLATE_INVALID_CONFIG"


def test_query_r243_008_04_translate_budget_smoke(client, owner_user):
    """T-QUERY-R243-008-04: probe_translate_from_config_budget_ms ≤15ms（mock，无 DB）。"""
    config_id, _ = _put_mysql_dataset_query(client)
    session = get_meta_session()
    try:
        record = session.get(QueryConfigRecord, uuid.UUID(config_id))
        assert record is not None
        elapsed = probe_translate_from_config_budget_ms(record)
        assert elapsed < 15.0
    finally:
        session.close()


def _grant_ds_analyst(ds_id: uuid.UUID) -> None:
    session = get_meta_session()
    try:
        role = session.scalar(select(AuthRole).where(AuthRole.code == "analyst"))
        if role is None:
            role = AuthRole(code="analyst", name="Analyst")
            session.add(role)
            session.flush()
        session.add(
            AuthResourceGrant(role_id=role.id, resource_type="datasource", resource_id=ds_id)
        )
        session.commit()
    finally:
        session.close()


def _create_mysql_ds(*, grant_analyst: bool = False) -> uuid.UUID:
    session = get_meta_session()
    try:
        row = create_data_source(
            session,
            DataSourceCreate(
                name=f"mysql-r243-{uuid.uuid4().hex[:6]}",
                code=f"mysql-r243-{uuid.uuid4().hex[:6]}",
                type="mysql",
                host="127.0.0.1",
                port=3306,
                database="demo",
                username="u",
                password="secret",
            ),
        )
        ds_id = row.id
    finally:
        session.close()
    if grant_analyst:
        _grant_ds_analyst(ds_id)
    return ds_id


@patch.object(QueryExecutor, "execute_sql")
def test_query_r243_009_01_full_chain(mock_execute, client, owner_user):
    """T-QUERY-R243-009-01: DS + PUT dataset_query + POST execute → 200 + rows 非空。"""
    mock_execute.return_value = QueryResult(
        columns=["order_amount", "status"],
        rows=[[100, "ok"], [200, "pending"]],
        row_count=2,
        truncated=False,
    )
    ds_id = _create_mysql_ds(grant_analyst=True)
    body = {
        "configType": "dataset_query",
        "schemaVersion": "1.0",
        "refType": "dataset",
        "refId": str(uuid.uuid4()),
        "payload": _valid_dataset_query_payload(str(ds_id)),
    }
    put = client.put("/api/v1/query/configs", headers=AUTH, json=body)
    config_id = put.json()["id"]
    resp = client.post(
        "/api/v1/query/dataset/execute",
        headers=AUTH,
        json={
            "dataSourceId": str(ds_id),
            "configId": config_id,
            "parameters": {},
            "limit": 10,
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["rowCount"] == 2
    assert len(body["rows"]) == 2


def test_query_r243_009_02_config_mismatch(client, owner_user):
    """T-QUERY-R243-009-02: configId/dataSourceId 不一致 → 422 QUERY_DATASET_CONFIG_MISMATCH。"""
    ds_id = _create_mysql_ds(grant_analyst=True)
    other_ds = str(uuid.uuid4())
    body = {
        "configType": "dataset_query",
        "schemaVersion": "1.0",
        "refType": "dataset",
        "refId": str(uuid.uuid4()),
        "payload": _valid_dataset_query_payload(str(ds_id)),
    }
    config_id = client.put("/api/v1/query/configs", headers=AUTH, json=body).json()["id"]
    resp = client.post(
        "/api/v1/query/dataset/execute",
        headers=AUTH,
        json={"dataSourceId": other_ds, "configId": config_id},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "QUERY_DATASET_CONFIG_MISMATCH"


def test_query_r243_009_03_viewer_no_ds_acl(client, other_user):
    """T-QUERY-R243-009-03: 无 DS ACL → 403。"""
    ds_id = _create_mysql_ds()
    body = {
        "configType": "dataset_query",
        "schemaVersion": "1.0",
        "refType": "dataset",
        "refId": str(uuid.uuid4()),
        "payload": _valid_dataset_query_payload(str(ds_id)),
    }
    config_id = client.put("/api/v1/query/configs", headers=AUTH, json=body).json()["id"]
    resp = client.post(
        "/api/v1/query/dataset/execute",
        headers=AUTH,
        json={"dataSourceId": str(ds_id), "configId": config_id},
    )
    assert resp.status_code == 403


def test_query_r243_009_04_forbidden_param_key(client, owner_user):
    """T-QUERY-R243-009-04: parameters 含 _sql → 422 QUERY_DATASET_PLAN_INVALID_PARAMS。"""
    ds_id = _create_mysql_ds(grant_analyst=True)
    body = {
        "configType": "dataset_query",
        "schemaVersion": "1.0",
        "refType": "dataset",
        "refId": str(uuid.uuid4()),
        "payload": _valid_dataset_query_payload(str(ds_id)),
    }
    config_id = client.put("/api/v1/query/configs", headers=AUTH, json=body).json()["id"]
    resp = client.post(
        "/api/v1/query/dataset/execute",
        headers=AUTH,
        json={
            "dataSourceId": str(ds_id),
            "configId": config_id,
            "parameters": {"_sql": "DROP TABLE t"},
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "QUERY_DATASET_PLAN_INVALID_PARAMS"


@patch.object(QueryExecutor, "execute_sql")
def test_query_r243_009_05_admin_rls_bypass_still_visible(mock_execute, client, admin_user):
    """T-QUERY-R243-009-05: admin 仍 assert_visible；mock execute 成功（r27 RLS 回归）。"""
    mock_execute.return_value = QueryResult(
        columns=["order_amount"], rows=[[1]], row_count=1, truncated=False,
    )
    ds_id = _create_mysql_ds(grant_analyst=True)
    body = {
        "configType": "dataset_query",
        "schemaVersion": "1.0",
        "refType": "dataset",
        "refId": str(uuid.uuid4()),
        "payload": _valid_dataset_query_payload(str(ds_id)),
    }
    config_id = client.put("/api/v1/query/configs", headers=AUTH, json=body).json()["id"]
    resp = client.post(
        "/api/v1/query/dataset/execute",
        headers=AUTH,
        json={
            "dataSourceId": str(ds_id),
            "configId": config_id,
            "rls": {"enabled": False},
        },
    )
    assert resp.status_code == 200
    mock_execute.assert_called_once()
