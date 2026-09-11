from __future__ import annotations

import os
import threading
import uuid
from unittest.mock import MagicMock, patch

import psycopg
import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.datasources import register_builtin_dialects
from app.datasources.dialects.errors import PG_AUTH_FAILED
from app.datasources.dialects.postgres import PostgresConnector
from app.datasources.models import DataSource, get_meta_session
from app.datasources.registry import registry
from app.datasources.schemas import DataSourceCreate
from app.datasources.service import create_data_source
from app.main import app

_DS_SQLITE_URL = "sqlite+pysqlite:///file:ds_r25_test?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def ds_r25_sqlite_env():
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


@pytest.fixture(autouse=True)
def reset_registry():
    registry._connectors.clear()
    register_builtin_dialects()
    yield
    registry._connectors.clear()


def test_registry_get_postgresql():
    """T-CONN-P01: registry.get('postgresql') 含 schema_browser。"""
    connector = registry.get("postgresql")
    assert connector.type == "postgresql"
    assert "schema_browser" in connector.capabilities


@patch("app.datasources.dialects.postgres.psycopg.connect")
def test_postgres_test_connection_ok(mock_connect):
    """T-CONN-P02: mock connect 成功 → ok=true。"""
    mock_conn = MagicMock()
    mock_connect.return_value = mock_conn
    result = PostgresConnector().test_connection(
        host="h", port=5432, database="d", username="u", password="p",
    )
    assert result.ok is True
    mock_conn.close.assert_called_once()


@patch("app.datasources.dialects.postgres.psycopg.connect")
def test_postgres_auth_failed_no_password_in_message(mock_connect):
    """T-CONN-P03: 认证失败 → PG_AUTH_FAILED，message 无密码。"""
    exc = psycopg.OperationalError("auth failed for user")
    exc.sqlstate = "28P01"
    mock_connect.side_effect = exc
    result = PostgresConnector().test_connection(
        host="h", port=5432, database="d", username="u", password="secret",
    )
    assert result.ok is False
    assert result.code == PG_AUTH_FAILED
    assert "secret" not in result.message


@patch.object(PostgresConnector, "open_connection")
def test_postgres_list_schemas(mock_open):
    """T-CONN-P04: list_schemas mock cursor。"""
    cur = MagicMock()
    cur.fetchall.return_value = [("public",)]
    conn = MagicMock()
    conn.cursor.return_value.__enter__.return_value = cur
    mock_open.return_value = conn
    items = PostgresConnector().list_schemas(conn)
    assert [s.name for s in items] == ["public"]


@pytest.fixture
def client():
    return TestClient(app)


def test_types_lists_mysql_and_postgresql(client):
    """T-DS-TY01/TY02: GET /types 含 mysql 与 postgresql + capabilities。"""
    resp = client.get("/api/v1/datasources/types", headers=AUTH)
    assert resp.status_code == 200
    types = {item["type"]: item for item in resp.json()["items"]}
    assert "mysql" in types and "postgresql" in types
    for key in ("displayName", "category", "capabilities"):
        assert key in types["mysql"]
    assert "connectivity_test" in types["mysql"]["capabilities"]


def test_types_empty_registry(client):
    """T-DS-TY03: 清空注册表 → items: []。"""
    registry._connectors.clear()
    resp = client.get("/api/v1/datasources/types", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json()["items"] == []


def test_types_unauthenticated_401(client):
    """T-DS-TY04: 未认证 → 401。"""
    assert client.get("/api/v1/datasources/types").status_code == 401


from app.datasources.pool import DataSourcePoolManager
from jwt_auth import AUTH, jwt_auth_headers


def test_pool_reuses_connection_same_id():
    """T-DS-PL01: 同一 dataSourceId 复用连接。"""
    mgr = DataSourcePoolManager()
    ds_id = uuid.uuid4()
    connector = MagicMock()
    conn1 = MagicMock()
    connector.open_connection.return_value = conn1
    kwargs = {"host": "a", "port": 5432, "database": "d", "username": "u", "password": "p"}
    with mgr.pooled_connection(ds_id, connector=connector, connect_kwargs=kwargs) as c1:
        pass
    with mgr.pooled_connection(ds_id, connector=connector, connect_kwargs=kwargs) as c2:
        pass
    assert connector.open_connection.call_count == 1
    assert c2 is conn1


def test_pool_isolates_different_ids():
    """T-DS-PL02: 不同 dataSourceId 不混用 connect 参数。"""
    mgr = DataSourcePoolManager()
    connector = MagicMock()
    connector.open_connection.side_effect = [MagicMock(name="a"), MagicMock(name="b")]
    with mgr.pooled_connection(uuid.uuid4(), connector=connector, connect_kwargs={"host": "a", "port": 1, "database": "d", "username": "u", "password": "p"}):
        pass
    with mgr.pooled_connection(uuid.uuid4(), connector=connector, connect_kwargs={"host": "b", "port": 2, "database": "d", "username": "u", "password": "p"}):
        pass
    assert connector.open_connection.call_count == 2


def test_evict_pool_closes_and_decrements():
    """T-DS-PL03: evict_pool 关闭连接并减计数。"""
    mgr = DataSourcePoolManager()
    ds_id = uuid.uuid4()
    connector = MagicMock()
    conn = MagicMock()
    connector.open_connection.return_value = conn
    kwargs = {"host": "h", "port": 1, "database": "d", "username": "u", "password": "p"}
    with mgr.pooled_connection(ds_id, connector=connector, connect_kwargs=kwargs):
        pass
    assert mgr.active_pool_count() == 1
    mgr.evict_pool(ds_id)
    assert mgr.active_pool_count() == 0
    conn.close.assert_called()


def test_pool_discards_connection_on_use_error():
    """T-DS-PL05: yield 期间异常时不将连接放回池。"""
    import pytest

    mgr = DataSourcePoolManager()
    ds_id = uuid.uuid4()
    connector = MagicMock()
    conn = MagicMock()
    connector.open_connection.return_value = conn
    kwargs = {"host": "h", "port": 1, "database": "d", "username": "u", "password": "p"}
    with pytest.raises(RuntimeError, match="boom"):
        with mgr.pooled_connection(ds_id, connector=connector, connect_kwargs=kwargs):
            raise RuntimeError("boom")
    conn.close.assert_called_once()
    fresh = MagicMock(name="fresh")
    connector.open_connection.return_value = fresh
    with mgr.pooled_connection(ds_id, connector=connector, connect_kwargs=kwargs) as c2:
        pass
    assert connector.open_connection.call_count == 2
    assert c2 is fresh


def test_pool_concurrent_smoke():
    """T-DS-PL04: 4 线程同一 id 无异常。"""
    mgr = DataSourcePoolManager()
    ds_id = uuid.uuid4()
    connector = MagicMock()
    connector.open_connection.return_value = MagicMock()
    kwargs = {"host": "h", "port": 1, "database": "d", "username": "u", "password": "p"}
    errors: list[Exception] = []

    def worker():
        try:
            with mgr.pooled_connection(ds_id, connector=connector, connect_kwargs=kwargs):
                pass
        except Exception as exc:
            errors.append(exc)

    threads = [threading.Thread(target=worker) for _ in range(4)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert errors == []


@pytest.fixture(autouse=True)
def ensure_ds_table():
    from app.datasources.models import Base, get_meta_engine
    from app.auth.models import Base as AuthBase
    from sqlalchemy import text

    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    AuthBase.metadata.create_all(engine)
    yield
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM auth_resource_grants"))
        conn.execute(text("DELETE FROM auth_user_roles"))
        conn.execute(text("DELETE FROM data_sources"))


def _create_ds_named(name: str, code: str):
    session = get_meta_session()
    try:
        return create_data_source(session, DataSourceCreate(
            name=name, code=code, type="postgresql",
            host="h", port=5432, database="d", username="u", password="p",
        ))
    finally:
        session.close()


def _dev_user(client, auth_headers):
    created = client.post("/api/v1/users", json={"username": "dev", "initialPassword": "Init-Pass-1234567"}, headers=auth_headers)
    if created.status_code == 201:
        return created.json()
    from sqlalchemy import select

    from app.auth.models import AuthUser

    session = get_meta_session()
    try:
        user = session.scalar(select(AuthUser).where(AuthUser.username == "dev"))
        if user is None:
            raise RuntimeError("dev user not found")
        return {"id": str(user.id), "username": user.username}
    finally:
        session.close()


def _grant_role_permissions(client, auth_headers, role_id: str, codes: list[str]) -> None:
    client.put(
        f"/api/v1/roles/{role_id}/permissions",
        headers=auth_headers,
        json={"permissionCodes": codes, "expectedVersion": 0},
    )


def _set_dev_roles(client, auth_headers, role_ids: list[str]):
    dev_user = _dev_user(client, auth_headers)
    client.put(
        f"/api/v1/users/{dev_user['id']}/roles",
        json={"role_ids": role_ids},
        headers=auth_headers,
    )


def _restore_dev_admin(client, auth_headers):
    _set_dev_roles(client, auth_headers, [])


def _dev_headers(client, auth_headers):
    """真实非 root dev 用户的 JWT headers。

    Task 4 起 AuthMiddleware 从 DB 解析身份并移除 username=dev 回退，auth_headers
    恒解析为 seed 的 root 管理员（root 直通 ACL/RLS）。ACL 受限行为须以仅绑定
    viewer 角色的非 root dev 用户身份验证。
    """
    from app.auth.models import AuthUser

    dev = _dev_user(client, auth_headers)
    session = get_meta_session()
    try:
        row = session.get(AuthUser, uuid.UUID(dev["id"]))
        token_version = row.token_version if row is not None else 1
    finally:
        session.close()
    return jwt_auth_headers(user_id=dev["id"], username="dev", token_version=token_version)


def _create_ds():
    session = get_meta_session()
    try:
        return create_data_source(session, DataSourceCreate(
            name="Meta DS", code=f"meta-ds-{uuid.uuid4().hex[:8]}", type="postgresql",
            host="h", port=5432, database="d", username="u", password="p",
        ))
    finally:
        session.close()


@patch("app.datasources.metadata.service.pool_manager.pooled_connection")
@patch("app.datasources.dialects.postgres.PostgresConnector.list_schemas")
def test_metadata_schemas_200(mock_list, mock_pool, client):
    """T-DS-MD01: mock list_schemas → 200。"""
    from contextlib import contextmanager
    from app.datasources.dialects.base import SchemaInfo

    mock_list.return_value = [SchemaInfo(name="public")]

    @contextmanager
    def _cm(*a, **k):
        yield MagicMock()

    mock_pool.side_effect = _cm
    ds = _create_ds()
    resp = client.get(f"/api/v1/datasources/{ds.id}/schemas", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json()["items"]


def test_metadata_tables_missing_schema_400(client):
    """T-DS-MD02: tables 无 schema → 400。"""
    ds = _create_ds()
    resp = client.get(f"/api/v1/datasources/{ds.id}/tables", headers=AUTH)
    assert resp.status_code == 400
    assert resp.json()["code"] == "METADATA_INVALID_REQUEST"


def test_acl_admin_sees_all(client, auth_headers):
    """T-DS-AC01: admin 列表见全部。"""
    _restore_dev_admin(client, auth_headers)
    ds1 = _create_ds_named("ACL DS1", f"acl-ds1-{uuid.uuid4().hex[:6]}")
    ds2 = _create_ds_named("ACL DS2", f"acl-ds2-{uuid.uuid4().hex[:6]}")
    resp = client.get("/api/v1/datasources", headers=auth_headers)
    assert resp.status_code == 200
    ids = {item["id"] for item in resp.json()["items"]}
    assert str(ds1.id) in ids and str(ds2.id) in ids


def test_acl_viewer_only_granted(client, auth_headers):
    """T-DS-AC02: viewer 仅见 grant id。"""
    _restore_dev_admin(client, auth_headers)
    granted = _create_ds_named("Granted", f"acl-granted-{uuid.uuid4().hex[:6]}")
    _create_ds_named("Hidden", f"acl-hidden-{uuid.uuid4().hex[:6]}")
    role = client.post(
        "/api/v1/roles",
        json={"code": f"acl_viewer_{uuid.uuid4().hex[:6]}", "name": "Viewer"},
        headers=auth_headers,
    ).json()
    client.post(
        "/api/v1/resource-grants",
        json={"role_id": role["id"], "resource_type": "datasource", "resource_id": str(granted.id)},
        headers=auth_headers,
    )
    _grant_role_permissions(client, auth_headers, role["id"], ["datasource:read"])
    _set_dev_roles(client, auth_headers, [role["id"]])
    resp = client.get("/api/v1/datasources", headers=_dev_headers(client, auth_headers))
    assert resp.status_code == 200
    ids = {item["id"] for item in resp.json()["items"]}
    assert ids == {str(granted.id)}
    _restore_dev_admin(client, auth_headers)


def test_acl_viewer_forbidden_detail(client, auth_headers):
    """T-DS-AC03: viewer GET 他人 id → 403 RESOURCE_FORBIDDEN。"""
    _restore_dev_admin(client, auth_headers)
    granted = _create_ds_named("Granted", f"acl-g2-{uuid.uuid4().hex[:6]}")
    hidden = _create_ds_named("Hidden", f"acl-h2-{uuid.uuid4().hex[:6]}")
    role = client.post(
        "/api/v1/roles",
        json={"code": f"acl_viewer2_{uuid.uuid4().hex[:6]}", "name": "Viewer"},
        headers=auth_headers,
    ).json()
    client.post(
        "/api/v1/resource-grants",
        json={"role_id": role["id"], "resource_type": "datasource", "resource_id": str(granted.id)},
        headers=auth_headers,
    )
    _grant_role_permissions(client, auth_headers, role["id"], ["datasource:read"])
    _set_dev_roles(client, auth_headers, [role["id"]])
    resp = client.get(f"/api/v1/datasources/{hidden.id}", headers=_dev_headers(client, auth_headers))
    assert resp.status_code == 403
    assert resp.json()["code"] == "RESOURCE_FORBIDDEN"
    _restore_dev_admin(client, auth_headers)


@patch("app.datasources.dialects.postgres.PostgresConnector.test_connection")
def test_acl_viewer_forbidden_test(mock_test, client, auth_headers):
    """T-DS-AC04: viewer POST test 他人 id → 403。"""
    _restore_dev_admin(client, auth_headers)
    granted = _create_ds_named("Granted", f"acl-g3-{uuid.uuid4().hex[:6]}")
    hidden = _create_ds_named("Hidden", f"acl-h3-{uuid.uuid4().hex[:6]}")
    role = client.post(
        "/api/v1/roles",
        json={"code": f"acl_viewer3_{uuid.uuid4().hex[:6]}", "name": "Viewer"},
        headers=auth_headers,
    ).json()
    client.post(
        "/api/v1/resource-grants",
        json={"role_id": role["id"], "resource_type": "datasource", "resource_id": str(granted.id)},
        headers=auth_headers,
    )
    _grant_role_permissions(client, auth_headers, role["id"], ["datasource:manage"])
    _set_dev_roles(client, auth_headers, [role["id"]])
    resp = client.post(f"/api/v1/datasources/{hidden.id}/test", headers=_dev_headers(client, auth_headers))
    assert resp.status_code == 403
    assert resp.json()["code"] == "RESOURCE_FORBIDDEN"
    mock_test.assert_not_called()
    _restore_dev_admin(client, auth_headers)


def test_acl_revoke_grant_forbidden(client, auth_headers):
    """T-DS-AC05: 撤权后 403。"""
    _restore_dev_admin(client, auth_headers)
    ds = _create_ds_named("Revoke DS", f"acl-revoke-{uuid.uuid4().hex[:6]}")
    role = client.post(
        "/api/v1/roles",
        json={"code": f"acl_revoke_{uuid.uuid4().hex[:6]}", "name": "Viewer"},
        headers=auth_headers,
    ).json()
    grant = client.post(
        "/api/v1/resource-grants",
        json={"role_id": role["id"], "resource_type": "datasource", "resource_id": str(ds.id)},
        headers=auth_headers,
    ).json()
    _grant_role_permissions(client, auth_headers, role["id"], ["datasource:read"])
    _set_dev_roles(client, auth_headers, [role["id"]])
    dev_headers = _dev_headers(client, auth_headers)
    assert client.get(f"/api/v1/datasources/{ds.id}", headers=dev_headers).status_code == 200
    client.delete(f"/api/v1/resource-grants/{grant['id']}", headers=auth_headers)
    resp = client.get(f"/api/v1/datasources/{ds.id}", headers=dev_headers)
    assert resp.status_code == 403
    assert resp.json()["code"] == "RESOURCE_FORBIDDEN"
    _restore_dev_admin(client, auth_headers)


@patch("app.datasources.dialects.postgres.PostgresConnector.list_columns")
@patch("app.datasources.metadata.service.pool_manager.pooled_connection")
def test_metadata_columns_200(mock_pool, mock_cols, client):
    """T-DS-MD03: columns mock 返回列定义。"""
    from contextlib import contextmanager

    from app.datasources.dialects.base import ColumnInfo

    mock_cols.return_value = [ColumnInfo(name="id", data_type="uuid", nullable=False)]

    @contextmanager
    def _cm(*a, **k):
        yield MagicMock()

    mock_pool.side_effect = _cm
    ds = _create_ds()
    resp = client.get(
        f"/api/v1/datasources/{ds.id}/columns?schema=public&table=users",
        headers=AUTH,
    )
    assert resp.status_code == 200
    body = resp.json()["items"][0]
    assert body["name"] == "id"
    assert body["dataType"] == "uuid"


@patch("app.datasources.metadata.service.pool_manager.pooled_connection")
def test_metadata_bad_credential_502_no_password(mock_pool, client):
    """T-DS-MD04: 连接失败 502，响应无 password。"""
    mock_pool.side_effect = Exception("connection failed")
    ds = _create_ds()
    resp = client.get(f"/api/v1/datasources/{ds.id}/schemas", headers=AUTH)
    assert resp.status_code == 502
    assert resp.json()["code"] == "METADATA_CONNECTION_FAILED"
    assert "password" not in resp.text.lower()


@patch("app.datasources.metadata.service.pool_manager.pooled_connection")
@patch("app.datasources.dialects.postgres.PostgresConnector.list_schemas")
def test_metadata_forbidden_403(mock_list, mock_pool, client, auth_headers):
    """T-DS-MD05: 未授权用户 → 403。"""
    from contextlib import contextmanager

    mock_list.return_value = []

    @contextmanager
    def _cm(*a, **k):
        yield MagicMock()

    mock_pool.side_effect = _cm
    _restore_dev_admin(client, auth_headers)
    hidden = _create_ds_named("Hidden MD", f"acl-md-{uuid.uuid4().hex[:6]}")
    role = client.post(
        "/api/v1/roles",
        json={"code": f"acl_md_{uuid.uuid4().hex[:6]}", "name": "Viewer"},
        headers=auth_headers,
    ).json()
    _grant_role_permissions(client, auth_headers, role["id"], ["datasource:read"])
    _set_dev_roles(client, auth_headers, [role["id"]])
    resp = client.get(f"/api/v1/datasources/{hidden.id}/schemas", headers=_dev_headers(client, auth_headers))
    assert resp.status_code == 403
    assert resp.json()["code"] == "RESOURCE_FORBIDDEN"
    mock_list.assert_not_called()
    _restore_dev_admin(client, auth_headers)


@patch("app.datasources.pool.pool_manager.evict_pool")
def test_delete_data_source_evicts_pool(mock_evict, client, auth_headers):
    """T-DS-PL05: delete 触发 evict_pool。"""
    _restore_dev_admin(client, auth_headers)
    ds = _create_ds_named("Delete Pool", f"del-pool-{uuid.uuid4().hex[:6]}")
    client.delete(f"/api/v1/datasources/{ds.id}", headers=auth_headers)
    mock_evict.assert_called_once_with(ds.id)


def test_metadata_columns_missing_params_400(client):
    """T-DS-MD06: columns 缺 schema/table → 400。"""
    ds = _create_ds()
    resp = client.get(f"/api/v1/datasources/{ds.id}/columns", headers=AUTH)
    assert resp.status_code == 400
    assert resp.json()["code"] == "METADATA_INVALID_REQUEST"


def test_registry_postgresql_display_name():
    """T-CONN-P05: postgresql display_name。"""
    connector = registry.get("postgresql")
    assert connector.display_name == "PostgreSQL"


def test_mysql_schema_browser_in_registry():
    """T-CONN-M15: mysql registry 含 schema_browser。"""
    connector = registry.get("mysql")
    assert "schema_browser" in connector.capabilities
