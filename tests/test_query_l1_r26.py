from __future__ import annotations

import os
import uuid
from contextlib import contextmanager
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, text

from app.auth.deps import UserContext
from app.core.config import get_settings
from app.datasources import register_builtin_dialects
from app.datasources.models import get_meta_session
from app.datasources.registry import registry
from app.datasources.schemas import DataSourceCreate
from app.datasources.service import create_data_source
from app.query.dialects import get_sql_dialect
from app.query.dialects.base import UnsupportedDialectError
from app.query.executor import QueryExecutor
from app.query.readonly import assert_readonly_sql
from app.query.schemas import QueryError
from app.query import service as query_service
from app.query.schemas import ExecuteRequest, RlsOptions

_QUERY_SQLITE_URL = "sqlite+pysqlite:///file:query_r26_test?mode=memory&cache=shared&uri=true"


def _dispose_meta_engines() -> None:
    from app.auth.models import get_meta_engine as auth_engine
    from app.datasources.models import get_meta_engine as ds_engine
    from app.ingestion.models import get_meta_engine as ing_engine
    from app.query.models import get_meta_engine as query_engine

    for fn in (auth_engine, ds_engine, query_engine, ing_engine):
        try:
            fn().dispose()
        except Exception:
            pass
        fn.cache_clear()


@pytest.fixture(scope="module", autouse=True)
def query_r26_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _QUERY_SQLITE_URL
    get_settings.cache_clear()
    _dispose_meta_engines()
    yield
    if previous is None:
        os.environ.pop("DATABASE_URL", None)
    else:
        os.environ["DATABASE_URL"] = previous
    get_settings.cache_clear()
    _dispose_meta_engines()


@pytest.fixture(scope="module", autouse=True)
def ensure_query_tables(query_r26_sqlite_env):
    from app.auth.models import Base as AuthBase, get_meta_engine
    from app.datasources.models import Base as DsBase
    from app.query.models import Base as QueryBase

    engine = get_meta_engine()
    AuthBase.metadata.create_all(engine)
    DsBase.metadata.create_all(engine)
    QueryBase.metadata.create_all(engine)
    yield


@pytest.fixture(autouse=True)
def reset_registry():
    registry._connectors.clear()
    register_builtin_dialects()
    yield
    registry._connectors.clear()


@pytest.fixture(autouse=True)
def clean_query_data():
    from app.datasources.models import get_meta_session

    yield
    session = get_meta_session()
    try:
        session.execute(text("DELETE FROM chart_query_bindings"))
        session.execute(text("DELETE FROM auth_resource_grants"))
        session.execute(text("DELETE FROM auth_user_roles"))
        session.execute(text("DELETE FROM data_sources"))
        session.commit()
    except Exception:
        session.rollback()
    finally:
        session.close()


def _meta_session():
    session = get_meta_session()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def meta_session():
    yield from _meta_session()


def _create_ds(name: str = "Query DS", code: str | None = None):
    session = get_meta_session()
    try:
        return create_data_source(session, DataSourceCreate(
            name=name,
            code=code or f"query-ds-{uuid.uuid4().hex[:8]}",
            type="postgresql",
            host="h", port=5432, database="d", username="u", password="p",
        ))
    finally:
        session.close()


def _dev_user(client, auth_headers):
    created = client.post("/api/v1/users", json={"username": "dev", "initialPassword": "Init-Pass-1234567"}, headers=auth_headers)
    if created.status_code == 201:
        return created.json()
    from app.auth.models import AuthUser

    session = get_meta_session()
    try:
        user = session.scalar(select(AuthUser).where(AuthUser.username == "dev"))
        if user is None:
            raise RuntimeError("dev user not found")
        return {"id": str(user.id), "username": user.username}
    finally:
        session.close()


def _set_dev_roles(client, auth_headers, role_ids: list[str]):
    dev_user = _dev_user(client, auth_headers)
    client.put(
        f"/api/v1/users/{dev_user['id']}/roles",
        json={"role_ids": role_ids},
        headers=auth_headers,
    )


def _restore_dev_admin(client, auth_headers):
    _set_dev_roles(client, auth_headers, [])


def _grant_role_permissions(client, auth_headers, role_id: str, codes: list[str]) -> None:
    client.put(
        f"/api/v1/roles/{role_id}/permissions",
        json={"permissionCodes": codes, "expectedVersion": 0},
        headers=auth_headers,
    )


def _setup_viewer_acl(client, auth_headers):
    """Return (visible_ds, hidden_ds, viewer_role_id)."""
    _restore_dev_admin(client, auth_headers)
    visible = _create_ds("Visible DS", f"vis-{uuid.uuid4().hex[:6]}")
    hidden = _create_ds("Hidden DS", f"hid-{uuid.uuid4().hex[:6]}")
    role = client.post(
        "/api/v1/roles",
        json={"code": f"query_viewer_{uuid.uuid4().hex[:6]}", "name": "Viewer"},
        headers=auth_headers,
    ).json()
    client.post(
        "/api/v1/resource-grants",
        json={"role_id": role["id"], "resource_type": "datasource", "resource_id": str(visible.id)},
        headers=auth_headers,
    )
    _grant_role_permissions(client, auth_headers, role["id"], ["datasource:read", "dataset:read"])
    _set_dev_roles(client, auth_headers, [role["id"]])
    return visible, hidden, role["id"]


@pytest.fixture
def query_seed(client, auth_headers):
    _restore_dev_admin(client, auth_headers)
    visible = _create_ds("Seed Visible", f"seed-vis-{uuid.uuid4().hex[:6]}")
    hidden = _create_ds("Seed Hidden", f"seed-hid-{uuid.uuid4().hex[:6]}")
    role = client.post(
        "/api/v1/roles",
        json={"code": f"seed_viewer_{uuid.uuid4().hex[:6]}", "name": "Viewer"},
        headers=auth_headers,
    ).json()
    client.post(
        "/api/v1/resource-grants",
        json={"role_id": role["id"], "resource_type": "datasource", "resource_id": str(visible.id)},
        headers=auth_headers,
    )
    _grant_role_permissions(client, auth_headers, role["id"], ["datasource:read", "dataset:read"])
    seed = {
        "ds_id": visible.id,
        "hidden_ds_id": hidden.id,
        "viewer_role_id": role["id"],
    }
    yield seed
    _restore_dev_admin(client, auth_headers)


@pytest.fixture
def viewer_headers(client, auth_headers, query_seed):
    """以真实非 root 的 dev 用户身份访问（Task 4 起中间件从 DB 解析身份）。

    旧模型下 auth_headers 会被回退解析为 username=dev；Task 4 移除该回退后，
    auth_headers 恒为 seed 的 root 管理员（root 直通 RLS）。故此处签发 dev 用户
    的 JWT，使其以仅绑定 viewer 角色的非 root 身份触发 RLS 可见性判定。
    """
    from jwt_auth import jwt_auth_headers

    from app.auth.models import AuthUser

    _restore_dev_admin(client, auth_headers)
    dev = _dev_user(client, auth_headers)
    _set_dev_roles(client, auth_headers, [query_seed["viewer_role_id"]])
    session = get_meta_session()
    try:
        row = session.get(AuthUser, uuid.UUID(dev["id"]))
        token_version = row.token_version if row is not None else 1
    finally:
        session.close()
    yield jwt_auth_headers(user_id=dev["id"], username="dev", token_version=token_version)
    _restore_dev_admin(client, auth_headers)


def _mock_pool_cursor(columns, rows):
    cur = MagicMock()
    cur.description = [(c,) for c in columns]
    cur.fetchmany.return_value = rows
    conn = MagicMock()
    conn.cursor.return_value = cur

    @contextmanager
    def _cm(*_a, **_k):
        yield conn

    return _cm


# --- T-Q-020~025: dialect tests ---


def test_mysql_quote_identifier():
    """T-Q-020: MySQL quote_identifier → backticks."""
    d = get_sql_dialect("mysql")
    assert d.quote_identifier("col") == "`col`"
    with pytest.raises(Exception):
        d.quote_identifier("bad-name")


def test_postgres_quote_identifier():
    """T-Q-021: PG quote_identifier → double quotes."""
    d = get_sql_dialect("postgresql")
    assert d.quote_identifier("col") == '"col"'


def test_mysql_wrap_limit():
    """T-Q-022: MySQL wrap_limit 含 LIMIT/OFFSET."""
    sql = get_sql_dialect("mysql").wrap_limit("SELECT 1", limit=10, offset=5)
    assert "LIMIT 10" in sql and "OFFSET 5" in sql


def test_postgres_wrap_limit():
    """T-Q-023: PG wrap_limit 含 LIMIT/OFFSET."""
    sql = get_sql_dialect("postgresql").wrap_limit("SELECT 1", limit=10, offset=5)
    assert "LIMIT 10" in sql and "OFFSET 5" in sql


def test_build_table_select_readonly():
    """T-Q-024: build_table_select 经 assert_readonly_sql."""
    for ct in ("mysql", "postgresql"):
        sql = get_sql_dialect(ct).build_table_select("public", "sales", limit=50, offset=0)
        assert_readonly_sql(sql)


def test_unknown_dialect():
    """T-Q-025: 未知 connector_type → UnsupportedDialectError（clickhouse 已注册）。"""
    with pytest.raises(UnsupportedDialectError):
        get_sql_dialect("unknown_type")


# --- readonly tests ---


def test_readonly_rejects_insert():
    with pytest.raises(QueryError) as exc:
        assert_readonly_sql("INSERT INTO t VALUES (1)")
    assert exc.value.code == "QUERY_NOT_READONLY"


def test_readonly_rejects_delete():
    with pytest.raises(QueryError) as exc:
        assert_readonly_sql("DELETE FROM t")
    assert exc.value.code == "QUERY_NOT_READONLY"


def test_readonly_accepts_select():
    assert_readonly_sql("SELECT 1") is None


# --- T-Q-010~013: executor mock ---


@patch("app.query.executor.pool_manager.pooled_connection")
def test_execute_table_mock_success(mock_pool, query_seed, meta_session):
    """T-Q-010: mode=table mock 成功返回列/行。"""
    mock_pool.side_effect = _mock_pool_cursor(["org_node_id", "amount"], [(1, 10)])
    session = meta_session
    user = UserContext(id="dev", username="dev", roles=["admin"])
    result = QueryExecutor().execute_table(
        session, user, query_seed["ds_id"], "public", "sales", limit=100,
        apply_rls=False,
    )
    assert result.columns == ["org_node_id", "amount"]
    assert result.row_count == 1


@patch("app.query.executor.pool_manager.pooled_connection")
def test_execute_table_not_found(mock_pool, query_seed, meta_session):
    """T-Q-011: 不存在表 → 404 QUERY_TABLE_NOT_FOUND。"""
    mock_pool.side_effect = lambda *a, **k: (_ for _ in ()).throw(
        RuntimeError("relation \"missing\" does not exist")
    )
    session = meta_session
    user = UserContext(id="dev", username="dev", roles=["admin"])
    with pytest.raises(QueryError) as exc:
        QueryExecutor().execute_table(
            session, user, query_seed["ds_id"], "public", "missing", limit=10, apply_rls=False,
        )
    assert exc.value.code == "QUERY_TABLE_NOT_FOUND"
    assert exc.value.status == 404


def test_execute_table_invalid_schema(query_seed, meta_session):
    """T-Q-012: 非法 schema 名 → 400。"""
    session = meta_session
    user = UserContext(id="dev", username="dev", roles=["admin"])
    with pytest.raises(Exception):
        QueryExecutor().execute_table(
            session, user, query_seed["ds_id"], "bad-schema!", "sales", limit=10, apply_rls=False,
        )


@patch("app.query.executor.pool_manager.pooled_connection")
def test_execute_table_offset_in_sql(mock_pool, query_seed, meta_session):
    """T-Q-013: limit/offset 分页 — dialect 生成含 OFFSET。"""
    mock_pool.side_effect = _mock_pool_cursor(["id"], [(1,)])
    session = meta_session
    user = UserContext(id="dev", username="dev", roles=["admin"])
    QueryExecutor().execute_table(
        session, user, query_seed["ds_id"], "public", "sales", limit=10, offset=5, apply_rls=False,
    )
    call_sql = mock_pool.call_args
    assert mock_pool.called


# --- T-Q-040~044: RLS service tests ---


@patch("app.query.executor.apply_rls_to_sql", side_effect=lambda s, u, sql, **kw: sql + " /*RLS*/")
@patch("app.query.executor.pool_manager.pooled_connection")
def test_rls_injected_on_execute(mock_pool, mock_rls, query_seed, meta_session):
    """T-Q-040: 有 org 授权用户执行时 apply_rls_to_sql 被调用。"""
    mock_pool.side_effect = _mock_pool_cursor(["id"], [(1,)])
    session = meta_session
    user = UserContext(id="dev", username="dev", roles=["admin"])
    payload = ExecuteRequest(
        data_source_id=query_seed["ds_id"],
        mode="sql",
        sql="SELECT 1 AS id",
        limit=10,
    )
    query_service.execute_query(session, user, payload)
    mock_rls.assert_called()


@patch("app.query.executor.apply_rls_to_sql")
@patch("app.query.executor.pool_manager.pooled_connection")
def test_rls_no_org_empty_rows(mock_pool, mock_rls, query_seed, meta_session):
    """T-Q-041: 无授权用户 → 200 空结果（RLS 1=0）。"""
    mock_rls.side_effect = lambda s, u, sql, **kw: sql + " WHERE (1=0)"
    mock_pool.side_effect = _mock_pool_cursor(["id"], [])
    session = meta_session
    user = UserContext(id="dev", username="dev", roles=["admin"])
    payload = ExecuteRequest(
        data_source_id=query_seed["ds_id"],
        mode="sql",
        sql="SELECT 1 AS id",
        limit=10,
    )
    result = query_service.execute_query(session, user, payload)
    assert result.row_count == 0


def test_rls_visibility_denied(query_seed, viewer_headers, client):
    """T-Q-042: 不可见 dataSource → 403。"""
    resp = client.post(
        "/api/v1/query/execute",
        json={
            "dataSourceId": str(query_seed["hidden_ds_id"]),
            "mode": "sql",
            "sql": "SELECT 1",
        },
        headers=viewer_headers,
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "RESOURCE_FORBIDDEN"


@patch("app.query.executor.apply_rls_to_sql", side_effect=lambda s, u, sql, **kw: f"{sql} AND (1=1)")
@patch("app.query.executor.pool_manager.pooled_connection")
def test_rls_merge_existing_where(mock_pool, mock_rls, query_seed, meta_session):
    """T-Q-043: apply_rls_to_sql 合并已有 WHERE。"""
    mock_pool.side_effect = _mock_pool_cursor(["id"], [(1,)])
    session = meta_session
    user = UserContext(id="dev", username="dev", roles=["admin"])
    payload = ExecuteRequest(
        data_source_id=query_seed["ds_id"],
        mode="sql",
        sql="SELECT 1 AS id WHERE x = 1",
        limit=10,
    )
    query_service.execute_query(session, user, payload)
    called_sql = mock_rls.call_args[0][2]
    assert "AND" in called_sql or mock_rls.called


@patch("app.query.executor.apply_rls_to_sql")
@patch("app.query.executor.pool_manager.pooled_connection")
def test_rls_disabled_only_in_development(mock_pool, mock_rls, query_seed, monkeypatch, meta_session):
    """T-Q-044: development 下 rls.enabled=false 不注入。"""
    monkeypatch.setenv("VITALSPAN_ENV", "development")
    get_settings.cache_clear()
    mock_pool.side_effect = _mock_pool_cursor(["id"], [(1,)])
    session = meta_session
    user = UserContext(id="dev", username="dev", roles=["admin"])
    payload = ExecuteRequest(
        data_source_id=query_seed["ds_id"],
        mode="sql",
        sql="SELECT 1 AS id",
        limit=10,
        rls=RlsOptions(enabled=False),
    )
    query_service.execute_query(session, user, payload)
    mock_rls.assert_not_called()
    get_settings.cache_clear()


# --- T-Q-001~006: API execute ---


@patch("app.query.executor.pool_manager.pooled_connection")
def test_post_execute_sql_success(mock_pool, client, query_seed, auth_headers):
    """T-Q-001: POST execute mock 成功 → 200 columns+rows+traceId。"""
    mock_pool.side_effect = _mock_pool_cursor(["id"], [(1,)])
    resp = client.post(
        "/api/v1/query/execute",
        json={
            "dataSourceId": str(query_seed["ds_id"]),
            "mode": "sql",
            "sql": "SELECT 1 AS id",
            "limit": 10,
            "rls": {"enabled": False},
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "columns" in body and "rows" in body and "traceId" in body


def test_post_execute_rejects_insert(client, query_seed, auth_headers):
    """T-Q-002: INSERT → 400 QUERY_NOT_READONLY。"""
    resp = client.post(
        "/api/v1/query/execute",
        json={
            "dataSourceId": str(query_seed["ds_id"]),
            "mode": "sql",
            "sql": "INSERT INTO t VALUES (1)",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 400
    assert resp.json()["code"] == "QUERY_NOT_READONLY"


def test_post_execute_rejects_delete(client, query_seed, auth_headers):
    """T-Q-003: DELETE → 400 QUERY_NOT_READONLY。"""
    resp = client.post(
        "/api/v1/query/execute",
        json={
            "dataSourceId": str(query_seed["ds_id"]),
            "mode": "sql",
            "sql": "DELETE FROM t",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 400
    assert resp.json()["code"] == "QUERY_NOT_READONLY"


def test_post_execute_visibility_denied(client, query_seed, viewer_headers):
    """T-Q-004: 不可见 dataSourceId → 403。"""
    resp = client.post(
        "/api/v1/query/execute",
        json={
            "dataSourceId": str(query_seed["hidden_ds_id"]),
            "mode": "sql",
            "sql": "SELECT 1",
        },
        headers=viewer_headers,
    )
    assert resp.status_code == 403


def test_post_execute_missing_datasource_422(client, auth_headers):
    """T-Q-005: 缺 dataSourceId → 422。"""
    resp = client.post(
        "/api/v1/query/execute",
        json={"mode": "sql", "sql": "SELECT 1"},
        headers=auth_headers,
    )
    assert resp.status_code == 422


def test_post_execute_limit_over_cap_422(client, query_seed, auth_headers):
    """T-Q-006: 超 limit 上限 → 422。"""
    cap = get_settings().query_default_limit
    resp = client.post(
        "/api/v1/query/execute",
        json={
            "dataSourceId": str(query_seed["ds_id"]),
            "mode": "sql",
            "sql": "SELECT 1",
            "limit": cap + 1,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 422


# --- T-Q-030~034: binding CRUD ---


def test_post_create_sql_binding(client, query_seed, auth_headers):
    """T-Q-030: POST 创建 sql 绑定 → 201。"""
    resp = client.post(
        "/api/v1/query/bindings",
        json={
            "name": "Sales SQL",
            "dataSourceId": str(query_seed["ds_id"]),
            "mode": "sql",
            "sql": "SELECT 1",
            "defaultLimit": 100,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert "id" in body and body["dataSourceId"] == str(query_seed["ds_id"])


def test_post_create_table_binding(client, query_seed, auth_headers):
    """T-Q-031: POST 创建 table 绑定 → 201。"""
    resp = client.post(
        "/api/v1/query/bindings",
        json={
            "name": "Sales Table",
            "dataSourceId": str(query_seed["ds_id"]),
            "mode": "table",
            "schema": "public",
            "table": "sales",
            "defaultLimit": 50,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["mode"] == "table"


@patch("app.query.executor.pool_manager.pooled_connection")
def test_binding_id_execute(mock_pool, client, query_seed, auth_headers):
    """T-Q-032: bindingId 执行 → 200 出数。"""
    mock_pool.side_effect = _mock_pool_cursor(["id"], [(1,)])
    created = client.post(
        "/api/v1/query/bindings",
        json={
            "name": "Exec Binding",
            "dataSourceId": str(query_seed["ds_id"]),
            "mode": "sql",
            "sql": "SELECT 1 AS id",
        },
        headers=auth_headers,
    ).json()
    resp = client.post(
        "/api/v1/query/execute",
        json={"bindingId": created["id"], "rls": {"enabled": False}},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["rowCount"] == 1


def test_create_binding_hidden_ds_403(client, query_seed, viewer_headers):
    """T-Q-033: 对不可见 DS 创建绑定 → 403。"""
    resp = client.post(
        "/api/v1/query/bindings",
        json={
            "name": "Hidden",
            "dataSourceId": str(query_seed["hidden_ds_id"]),
            "mode": "sql",
            "sql": "SELECT 1",
        },
        headers=viewer_headers,
    )
    assert resp.status_code == 403


def test_list_bindings_only_visible(client, query_seed, auth_headers, viewer_headers):
    """T-Q-034: GET 列表仅可见 DS 绑定。"""
    client.post(
        "/api/v1/query/bindings",
        json={
            "name": "Visible Binding",
            "dataSourceId": str(query_seed["ds_id"]),
            "mode": "sql",
            "sql": "SELECT 1",
        },
        headers=auth_headers,
    )
    _restore_dev_admin(client, auth_headers)
    client.post(
        "/api/v1/query/bindings",
        json={
            "name": "Hidden Binding",
            "dataSourceId": str(query_seed["hidden_ds_id"]),
            "mode": "sql",
            "sql": "SELECT 1",
        },
        headers=auth_headers,
    )
    _set_dev_roles(client, auth_headers, [query_seed["viewer_role_id"]])
    resp = client.get("/api/v1/query/bindings", headers=viewer_headers)
    assert resp.status_code == 200
    names = {item["name"] for item in resp.json()["items"]}
    assert "Visible Binding" in names
    assert "Hidden Binding" not in names
    _restore_dev_admin(client, auth_headers)
