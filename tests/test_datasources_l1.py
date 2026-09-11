from __future__ import annotations

import os
import time
import uuid
from unittest.mock import MagicMock, patch

import pytest
from crypto_test_env import settings_kwargs
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import select, text

from jwt_auth import jwt_auth_headers
from app.core.config import Settings, get_settings
from app.datasources import register_builtin_dialects
from app.datasources.credentials import decrypt_credential, encrypt_credential
from app.datasources.dialects.mysql import MysqlConnector
from app.datasources.models import DataSource, get_meta_session
from app.datasources.registry import (
    ConnectorAlreadyRegisteredError,
    ConnectorNotFoundError,
    registry,
    register_dialect,
)
from app.datasources.schemas import DataSourceCreate
from app.datasources.service import create_data_source
from app.main import app

get_settings.cache_clear()

_DS_SQLITE_URL = "sqlite+pysqlite:///file:ds_l1_test?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def ds_l1_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _DS_SQLITE_URL
    get_settings.cache_clear()
    from app.auth.models import get_meta_engine as auth_get_meta_engine
    from app.datasources.models import get_meta_engine

    get_meta_engine.cache_clear()
    auth_get_meta_engine.cache_clear()
    yield
    if previous is None:
        os.environ.pop("DATABASE_URL", None)
    else:
        os.environ["DATABASE_URL"] = previous
    get_settings.cache_clear()
    get_meta_engine.cache_clear()
    auth_get_meta_engine.cache_clear()


@pytest.fixture(scope="module", autouse=True)
def ensure_data_sources_table():
    from app.datasources.models import Base, get_meta_engine
    from app.auth.models import Base as AuthBase

    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    AuthBase.metadata.create_all(engine)
    yield
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM data_sources"))


@pytest.fixture(autouse=True)
def clean_data_sources_between_tests():
    from app.datasources.models import get_meta_engine

    yield
    engine = get_meta_engine()
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM data_sources"))


@pytest.fixture(autouse=True)
def reset_registry():
    registry._connectors.clear()
    register_builtin_dialects()
    yield
    registry._connectors.clear()


def test_registry_list_types_includes_mysql():
    """T-DS-R01: list_types() 含 mysql。"""
    types = {item.type: item for item in registry.list_types()}
    assert "mysql" in types
    assert types["mysql"].category == "relational"
    assert "connectivity_test" in types["mysql"].capabilities


def test_registry_get_mysql_returns_connector():
    """T-DS-R02: get('mysql') 返回方言实例。"""
    connector = registry.get("mysql")
    assert connector.type == "mysql"
    assert callable(connector.test_connection)


def test_registry_get_unknown_raises():
    """T-DS-R03: get('unknown') 抛 ConnectorNotFoundError。"""
    with pytest.raises(ConnectorNotFoundError):
        registry.get("unknown")


def test_registry_duplicate_register_rejected():
    """T-DS-R04: 重复 register 同 type 抛 ConnectorAlreadyRegisteredError。"""
    with pytest.raises(ConnectorAlreadyRegisteredError):
        register_dialect(MysqlConnector())


def test_mysql_connector_attributes():
    """T-CONN-M01: 方言属性符合契约。"""
    connector = MysqlConnector()
    assert connector.type == "mysql"
    assert connector.category == "relational"
    assert connector.capabilities == ("connectivity_test", "schema_browser")
    assert connector.display_name == "MySQL"


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_mysql_mock_connect_success(mock_connect):
    """T-CONN-M02: mock connect 成功。"""
    connection = MagicMock()
    mock_connect.return_value = connection
    result = MysqlConnector().test_connection(
        host="127.0.0.1",
        port=3306,
        database="demo",
        username="root",
        password="secret",
    )
    assert result.ok is True
    assert result.latency_ms is not None
    connection.ping.assert_called_once_with(reconnect=False)
    connection.close.assert_called_once()


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_mysql_mock_operational_error(mock_connect):
    """T-CONN-M03: mock OperationalError 脱敏失败。"""
    import pymysql.err

    mock_connect.side_effect = pymysql.err.OperationalError(1045, "Access denied for user")
    result = MysqlConnector().test_connection(
        host="127.0.0.1",
        port=3306,
        database="demo",
        username="root",
        password="secret",
    )
    assert result.ok is False
    assert "Access denied" in result.message
    assert "secret" not in result.message


def test_credential_encrypt_decrypt_roundtrip():
    """T-DS-K01: 加解密 round-trip。"""
    plain = "mysql-source-password"
    cipher = encrypt_credential(plain)
    assert cipher != plain
    assert decrypt_credential(cipher) == plain


def test_settings_missing_credential_sm4_key_raises(monkeypatch):
    """T-DS-K04: 缺 CREDENTIAL_SM4_KEY 时 Settings 构造失败。"""
    kwargs = settings_kwargs()
    kwargs["credential_sm4_key"] = ""
    with pytest.raises(ValidationError):
        Settings(**kwargs)
    get_settings.cache_clear()


def test_data_sources_table_exists():
    """T-DS-INFRA: data_sources 表 create_all 成功。"""
    from app.datasources.models import Base, get_meta_engine

    assert "data_sources" in Base.metadata.tables
    assert get_meta_engine() is not None


def _sample_create() -> DataSourceCreate:
    return DataSourceCreate(
        name="Demo MySQL",
        code="demo_mysql",
        type="mysql",
        host="127.0.0.1",
        port=3306,
        database="demo",
        username="root",
        password="plain-secret",
    )


def test_db_stores_encrypted_password_not_plaintext():
    """T-DS-K02: DB 存密文非明文。"""
    session = get_meta_session()
    try:
        create_data_source(session, _sample_create())
        row = session.scalar(select(DataSource).where(DataSource.code == "demo_mysql"))
        assert row is not None
        assert row.password_encrypted != "plain-secret"
    finally:
        session.close()


def test_data_source_out_masks_password():
    """T-DS-K03: API Out 层脱敏。"""
    session = get_meta_session()
    try:
        out = create_data_source(session, _sample_create())
        assert out.password == "***"
        assert not hasattr(out, "password_encrypted")
    finally:
        session.close()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def auth_headers() -> dict[str, str]:
    return jwt_auth_headers()


def _payload() -> dict:
    return {
        "name": "Demo MySQL",
        "code": "demo_mysql",
        "type": "mysql",
        "host": "127.0.0.1",
        "port": 3306,
        "database": "demo",
        "username": "root",
        "password": "plain-secret",
    }


def test_openapi_includes_datasources_paths(client):
    """T-DS-R-openapi: OpenAPI 含 datasources 路径。"""
    spec = client.get("/openapi.json").json()
    assert "/api/v1/datasources" in spec["paths"]


def test_create_list_get_update_delete_roundtrip(client, auth_headers):
    """T-DS-C01~C05: CRUD roundtrip。"""
    created = client.post("/api/v1/datasources", json=_payload(), headers=auth_headers)
    assert created.status_code == 201
    body = created.json()
    ds_id = body["id"]
    assert body["password"] == "***"

    listed = client.get("/api/v1/datasources", headers=auth_headers)
    assert listed.status_code == 200
    body = listed.json()
    assert "items" in body
    assert body.get("total", len(body["items"])) >= 1
    assert any(item["id"] == ds_id for item in body["items"])

    detail = client.get(f"/api/v1/datasources/{ds_id}", headers=auth_headers)
    assert detail.status_code == 200
    assert detail.json()["password"] == "***"

    updated = client.put(
        f"/api/v1/datasources/{ds_id}",
        json={
            "name": "Demo MySQL Updated",
            "host": "127.0.0.1",
            "port": 3307,
            "database": "demo",
            "username": "root",
            "password": "",
            "description": "updated",
        },
        headers=auth_headers,
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Demo MySQL Updated"
    assert updated.json()["code"] == "demo_mysql"
    assert updated.json()["type"] == "mysql"

    deleted = client.delete(f"/api/v1/datasources/{ds_id}", headers=auth_headers)
    assert deleted.status_code == 204
    assert client.get(f"/api/v1/datasources/{ds_id}", headers=auth_headers).status_code == 404


def test_duplicate_code_conflict(client, auth_headers):
    """T-DS-C06: 重复 code → 409。"""
    assert client.post("/api/v1/datasources", json=_payload(), headers=auth_headers).status_code == 201
    dup = client.post("/api/v1/datasources", json=_payload(), headers=auth_headers)
    assert dup.status_code == 409
    assert dup.json()["code"] == "DATASOURCE_CODE_CONFLICT"


def test_duplicate_name_conflict(client, auth_headers):
    """T-DS-C07: 重复 name → 409。"""
    first = _payload()
    second = {**_payload(), "code": "demo_mysql_2"}
    assert client.post("/api/v1/datasources", json=first, headers=auth_headers).status_code == 201
    dup = client.post("/api/v1/datasources", json=second, headers=auth_headers)
    assert dup.status_code == 409
    assert dup.json()["code"] == "DATASOURCE_NAME_CONFLICT"


def test_invalid_connector_type(client, auth_headers):
    """T-DS-C08: 非法 type → 422。"""
    bad = {**_payload(), "type": "couchdb", "code": "couch_ds"}
    resp = client.post("/api/v1/datasources", json=bad, headers=auth_headers)
    assert resp.status_code == 422
    assert resp.json()["code"] == "UNKNOWN_CONNECTOR_TYPE"


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_draft_test_connection_success(mock_connect, client, auth_headers):
    """T-DS-T01: POST /datasources/test mock 成功。"""
    connection = MagicMock()
    mock_connect.return_value = connection
    resp = client.post("/api/v1/datasources/test", json=_payload(), headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert isinstance(body["latencyMs"], int)


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_draft_test_connection_refused(mock_connect, client, auth_headers):
    """T-DS-T02: mock 拒绝连接。"""
    import pymysql.err

    time.sleep(2.1)
    mock_connect.side_effect = pymysql.err.OperationalError(2003, "Connection refused")
    resp = client.post("/api/v1/datasources/test", json=_payload(), headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert "refused" in body["message"].lower() or "Connection refused" in body["message"]
    assert "plain-secret" not in body["message"]


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_saved_test_connection_success(mock_connect, client, auth_headers):
    """T-DS-T03: POST /{id}/test 已保存实例。"""
    connection = MagicMock()
    mock_connect.return_value = connection
    created = client.post("/api/v1/datasources", json=_payload(), headers=auth_headers)
    ds_id = created.json()["id"]
    time.sleep(2.1)
    resp = client.post(f"/api/v1/datasources/{ds_id}/test", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["ok"] is True


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_saved_test_bad_credentials(mock_connect, client, auth_headers):
    """T-DS-T04: 错误凭据 mock。"""
    import pymysql.err

    mock_connect.side_effect = pymysql.err.OperationalError(1045, "Access denied for user 'root'@'localhost'")
    created = client.post(
        "/api/v1/datasources",
        json={**_payload(), "code": "bad_cred_ds"},
        headers=auth_headers,
    )
    ds_id = created.json()["id"]
    time.sleep(2.1)
    resp = client.post(f"/api/v1/datasources/{ds_id}/test", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["ok"] is False
    assert "plain-secret" not in resp.json()["message"]


def test_saved_test_not_found(client, auth_headers):
    """T-DS-T05: 不存在 id → 404。"""
    missing = uuid.uuid4()
    resp = client.post(f"/api/v1/datasources/{missing}/test", headers=auth_headers)
    assert resp.status_code == 404
    assert resp.json()["code"] == "DATASOURCE_NOT_FOUND"


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_end_to_end_create_and_test(mock_connect, client, auth_headers):
    """T-CONN-M04: 创建 mysql + test 串联。"""
    connection = MagicMock()
    mock_connect.return_value = connection
    created = client.post(
        "/api/v1/datasources",
        json={**_payload(), "code": "e2e_ds"},
        headers=auth_headers,
    )
    assert created.status_code == 201
    ds_id = created.json()["id"]
    time.sleep(2.1)
    tested = client.post(f"/api/v1/datasources/{ds_id}/test", headers=auth_headers)
    assert tested.status_code == 200
    assert tested.json()["ok"] is True
