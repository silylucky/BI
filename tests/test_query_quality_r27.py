from __future__ import annotations

import os
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import select, text

from app.auth.deps import UserContext
from app.core.config import get_settings
from app.datasources import register_builtin_dialects
from app.datasources.credentials import encrypt_credential
from app.datasources.models import DataSource, get_meta_session
from app.datasources.registry import registry
from app.datasources.schemas import DataSourceCreate
from app.datasources.service import create_data_source
from app.query.dialects import get_sql_dialect
from app.query.dialects.base import UnsupportedDialectError
from app.query.executor import QueryExecutor
from app.query.readonly import assert_readonly_sql
from app.query.rls.guard import apply_rls_to_sql
from app.query.schemas import QueryError

_QUERY_SQLITE_URL = "sqlite+pysqlite:///file:query_r27_test?mode=memory&cache=shared&uri=true"


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


@pytest.fixture
def meta_session():
    session = get_meta_session()
    try:
        yield session
    finally:
        session.close()


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
    seed = {
        "ds_id": visible.id,
        "hidden_ds_id": hidden.id,
        "viewer_role_id": role["id"],
    }
    yield seed
    _restore_dev_admin(client, auth_headers)


@pytest.fixture
def viewer_headers(client, auth_headers, query_seed):
    """以真实非 root 的 dev 用户身份访问（Task 4 移除 username=dev 中间件回退后，
    auth_headers 恒为 seed 的 root 管理员，root 直通 RLS）。签发 dev 用户 JWT，
    使其以仅绑定 viewer 角色的非 root 身份触发 RLS 可见性判定。"""
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


@pytest.fixture
def mock_pool():
    def _factory(columns, rows):
        return _mock_pool_cursor(columns, rows)
    return _factory


def _create_ch_ds(name: str = "CH DS"):
    """Insert clickhouse metadata row (no CONN-007 connector)."""
    session = get_meta_session()
    try:
        row = DataSource(
            name=name,
            code=f"ch-ds-{uuid.uuid4().hex[:8]}",
            type="clickhouse",
            host="h",
            port=9000,
            database="d",
            username="u",
            password_encrypted=encrypt_credential("p"),
        )
        session.add(row)
        session.commit()
        session.refresh(row)
        return row
    finally:
        session.close()


def _ch_connector_patch(mock_pool_fn):
    return (
        patch.object(QueryExecutor, "_connector_kwargs", return_value=(MagicMock(), {}, 2)),
        patch("app.query.executor.pool_manager.pooled_connection", mock_pool_fn),
    )


# --- T-Q-R27-004: ClickHouse dialect ---


def test_clickhouse_dialect_registered():
    """T-Q-R27-004-01: clickhouse 已注册；unknown_type 仍抛 UnsupportedDialectError。"""
    d = get_sql_dialect("clickhouse")
    assert d.connector_type == "clickhouse"
    with pytest.raises(UnsupportedDialectError):
        get_sql_dialect("unknown_type")


def test_clickhouse_quote_identifier():
    """T-Q-R27-004-02: quote_identifier → backticks；非法名抛错。"""
    d = get_sql_dialect("clickhouse")
    assert d.quote_identifier("col") == "`col`"
    with pytest.raises(Exception):
        d.quote_identifier("bad-name")


def test_clickhouse_wrap_limit():
    """T-Q-R27-004-03: wrap_limit 后缀 LIMIT/OFFSET，无子查询包裹。"""
    d = get_sql_dialect("clickhouse")
    sql = d.wrap_limit("SELECT 1", limit=10, offset=2)
    assert "LIMIT 10" in sql
    assert "OFFSET 2" in sql
    assert "SELECT * FROM (" not in sql


def test_clickhouse_build_table_select_readonly():
    """T-Q-R27-004-04: build_table_select 经 assert_readonly_sql。"""
    sql = get_sql_dialect("clickhouse").build_table_select("db", "t", limit=50)
    assert_readonly_sql(sql)


def test_execute_clickhouse_sql_success(mock_pool, query_seed, meta_session):
    """T-Q-R27-004-05: clickhouse 数据源 + mock pooled_connection → execute 200。"""
    ds = _create_ch_ds()
    user = UserContext(id="dev", username="dev", roles=["admin"])
    pool = mock_pool(["id"], [[1]])
    with patch.object(QueryExecutor, "_connector_kwargs", return_value=(MagicMock(), {}, 2)):
        with patch("app.query.executor.pool_manager.pooled_connection", pool):
            result = QueryExecutor().execute_sql(
                meta_session, user, ds.id, "SELECT 1", limit=100, apply_rls=False,
            )
    assert result.row_count == 1


def test_execute_clickhouse_syntax_error(mock_pool, query_seed, meta_session):
    """T-Q-R27-004-06: mock syntax error → 400 QUERY_SYNTAX_ERROR。"""
    ds = _create_ch_ds()
    user = UserContext(id="dev", username="dev", roles=["admin"])

    @contextmanager
    def _fail(*_a, **_k):
        raise RuntimeError("Syntax error: failed at position 1 (code: 62)")
        yield  # pragma: no cover

    with patch.object(QueryExecutor, "_connector_kwargs", return_value=(MagicMock(), {}, 2)):
        with patch("app.query.executor.pool_manager.pooled_connection", _fail):
            with pytest.raises(QueryError) as exc:
                QueryExecutor().execute_sql(
                    meta_session, user, ds.id, "SELECT bad", limit=10, apply_rls=False,
                )
    assert exc.value.code == "QUERY_SYNTAX_ERROR"
    assert exc.value.status == 400


def test_execute_clickhouse_table_not_found(mock_pool, query_seed, meta_session):
    """T-Q-R27-004-07: mock Code: 60 Unknown table → 404 QUERY_TABLE_NOT_FOUND。"""
    ds = _create_ch_ds()
    user = UserContext(id="dev", username="dev", roles=["admin"])

    @contextmanager
    def _fail(*_a, **_k):
        raise RuntimeError("Code: 60. DB::Exception: Unknown table default.missing")
        yield  # pragma: no cover

    with patch.object(QueryExecutor, "_connector_kwargs", return_value=(MagicMock(), {}, 2)):
        with patch("app.query.executor.pool_manager.pooled_connection", _fail):
            with pytest.raises(QueryError) as exc:
                QueryExecutor().execute_sql(
                    meta_session, user, ds.id, "SELECT 1", limit=10, apply_rls=False,
                )
    assert exc.value.code == "QUERY_TABLE_NOT_FOUND"
    assert exc.value.status == 404


# --- T-Q-R27-001: readonly guard ---


@pytest.mark.parametrize("sql", [
    "INSERT INTO t VALUES (1)",
    "UPDATE t SET x=1",
    "DELETE FROM t",
    "CREATE TABLE x (id INT)",
    "DROP TABLE t",
])
def test_readonly_rejects_dml_ddl(sql):
    """T-Q-R27-001-01: DML/DDL → QUERY_NOT_READONLY。"""
    with pytest.raises(QueryError) as exc:
        assert_readonly_sql(sql)
    assert exc.value.code == "QUERY_NOT_READONLY"


def test_readonly_rejects_multi_statement():
    """T-Q-R27-001-02: 多语句 SELECT → QUERY_NOT_READONLY。"""
    with pytest.raises(QueryError) as exc:
        assert_readonly_sql("SELECT 1; SELECT 2")
    assert exc.value.code == "QUERY_NOT_READONLY"


def test_readonly_rejects_comment_bypass_delete():
    """T-Q-R27-001-03: 块注释后行内 DELETE → QUERY_NOT_READONLY。"""
    with pytest.raises(QueryError) as exc:
        assert_readonly_sql("SELECT 1 /*x*/ ; DELETE FROM t")
    assert exc.value.code == "QUERY_NOT_READONLY"


def test_readonly_accepts_line_comment_select():
    """T-Q-R27-001-04: 行注释 + SELECT 通过。"""
    assert_readonly_sql("-- comment\nSELECT 1") is None


def test_readonly_rejects_oversized_sql():
    """T-Q-R27-001-05: 65537 字符 → QUERY_SQL_TOO_LONG。"""
    with pytest.raises(QueryError) as exc:
        assert_readonly_sql("SELECT " + "1" * 65530)
    assert exc.value.code == "QUERY_SQL_TOO_LONG"


def test_readonly_concurrent_smoke():
    """T-Q-R27-001-06: 并发 20 次 assert_readonly_sql 无异常。"""

    def _run():
        assert_readonly_sql("SELECT 1")

    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(lambda _: _run(), range(20)))


def test_readonly_perf_p95_under_50ms():
    """T-Q-R27-001-07: 只读校验 P95 < 50ms（本机 mock 基线）。"""
    samples = []
    for _ in range(100):
        start = time.perf_counter()
        assert_readonly_sql("SELECT 1")
        samples.append(time.perf_counter() - start)
    samples.sort()
    p95 = samples[94]
    assert p95 < 0.05, f"P95 {p95:.4f}s exceeds 50ms"


# --- T-Q-R27-002: table mode boundaries ---


def test_execute_table_empty_rows(mock_pool, query_seed, meta_session):
    """T-Q-R27-002-01: mock 0 行 → rowCount=0。"""
    user = UserContext(id="dev", username="dev", roles=["admin"])
    pool = mock_pool(["id"], [])
    with patch("app.query.executor.pool_manager.pooled_connection", pool):
        result = QueryExecutor().execute_table(
            meta_session, user, query_seed["ds_id"], "public", "empty_t", limit=100,
            apply_rls=False,
        )
    assert result.row_count == 0


def test_execute_table_default_limit_cap(mock_pool, query_seed, meta_session):
    """T-Q-R27-002-02: limit=query_default_limit 成功。"""
    cap = get_settings().query_default_limit
    user = UserContext(id="dev", username="dev", roles=["admin"])
    captured = {}

    @contextmanager
    def _capture(*_a, **_k):
        conn = MagicMock()
        cur = MagicMock()
        cur.description = [("id",)]
        cur.fetchmany.return_value = []
        conn.cursor.return_value = cur
        cur.execute.side_effect = lambda sql: captured.update({"sql": sql})
        yield conn

    with patch("app.query.executor.pool_manager.pooled_connection", _capture):
        QueryExecutor().execute_table(
            meta_session, user, query_seed["ds_id"], "public", "t", limit=cap,
            apply_rls=False,
        )
    assert f"LIMIT {cap}" in captured.get("sql", "")


def test_execute_limit_over_cap_422(client, query_seed, auth_headers):
    """T-Q-R27-002-03: limit > query_default_limit → 422。"""
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


def test_execute_table_invalid_identifier(query_seed, meta_session):
    """T-Q-R27-002-04: 非法 schema/table → 400。"""
    from app.auth.rls.predicate import RlsConfigError

    user = UserContext(id="dev", username="dev", roles=["admin"])
    with pytest.raises(RlsConfigError):
        QueryExecutor().execute_table(
            meta_session, user, query_seed["ds_id"], "bad!", "t", limit=10, apply_rls=False,
        )


def test_execute_table_timeout(mock_pool, query_seed, meta_session):
    """T-Q-R27-002-05: mock timed out → 504 QUERY_TIMEOUT。"""
    user = UserContext(id="dev", username="dev", roles=["admin"])

    @contextmanager
    def _timeout(*_a, **_k):
        raise RuntimeError("query timed out")
        yield  # pragma: no cover

    with patch("app.query.executor.pool_manager.pooled_connection", _timeout):
        with pytest.raises(QueryError) as exc:
            QueryExecutor().execute_table(
                meta_session, user, query_seed["ds_id"], "public", "t", limit=10, apply_rls=False,
            )
    assert exc.value.code == "QUERY_TIMEOUT"
    assert exc.value.status == 504


def test_execute_table_offset_in_sql(mock_pool, query_seed, meta_session):
    """T-Q-R27-002-06: offset=100 table 模式 SQL 含 OFFSET 100。"""
    user = UserContext(id="dev", username="dev", roles=["admin"])
    captured = {}

    @contextmanager
    def _capture(*_a, **_k):
        conn = MagicMock()
        cur = MagicMock()
        cur.description = [("id",)]
        cur.fetchmany.return_value = [[1]]
        conn.cursor.return_value = cur
        cur.execute.side_effect = lambda sql: captured.update({"sql": sql})
        yield conn

    with patch("app.query.executor.pool_manager.pooled_connection", _capture):
        QueryExecutor().execute_table(
            meta_session, user, query_seed["ds_id"], "public", "t",
            limit=50, offset=100, apply_rls=False,
        )
    assert "OFFSET 100" in captured["sql"]


def test_execute_clickhouse_table_mode(mock_pool, query_seed, meta_session):
    """T-Q-R27-002-07: clickhouse 数据源 table 模式 mock 成功。"""
    ds = _create_ch_ds("CH Table")
    user = UserContext(id="dev", username="dev", roles=["admin"])
    pool = mock_pool(["id"], [[1]])
    with patch.object(QueryExecutor, "_connector_kwargs", return_value=(MagicMock(), {}, 2)):
        with patch("app.query.executor.pool_manager.pooled_connection", pool):
            result = QueryExecutor().execute_table(
                meta_session, user, ds.id, "db", "t", limit=50, apply_rls=False,
            )
    assert result.row_count == 1


# --- T-Q-R27-005: chartId binding ---


def test_binding_chart_id_conflict(client, query_seed, auth_headers):
    """T-Q-R27-005-01: 同 chartId 两次创建 → 第二个 409 BINDING_CHART_CONFLICT。"""
    chart_id = str(uuid.uuid4())
    body = {
        "name": "B1",
        "dataSourceId": str(query_seed["ds_id"]),
        "mode": "sql",
        "sql": "SELECT 1",
        "chartId": chart_id,
    }
    assert client.post("/api/v1/query/bindings", json=body, headers=auth_headers).status_code == 201
    resp = client.post("/api/v1/query/bindings", json={**body, "name": "B2"}, headers=auth_headers)
    assert resp.status_code == 409
    assert resp.json()["code"] == "BINDING_CHART_CONFLICT"


def test_binding_concurrent_patch_last_write_wins(client, query_seed, auth_headers):
    """T-Q-R27-005-02: 并发 PATCH 同 binding → 均 200。"""
    created = client.post(
        "/api/v1/query/bindings",
        json={
            "name": "Orig",
            "dataSourceId": str(query_seed["ds_id"]),
            "mode": "sql",
            "sql": "SELECT 1",
        },
        headers=auth_headers,
    ).json()
    bid = created["id"]
    base = {
        "dataSourceId": str(query_seed["ds_id"]),
        "mode": "sql",
        "sql": "SELECT 1",
        "defaultLimit": 100,
    }
    r1 = client.put(f"/api/v1/query/bindings/{bid}", json={**base, "name": "A"}, headers=auth_headers)
    r2 = client.put(f"/api/v1/query/bindings/{bid}", json={**base, "name": "B"}, headers=auth_headers)
    assert r1.status_code == 200
    assert r2.status_code == 200


def test_binding_delete_not_visible(client, query_seed, auth_headers):
    """T-Q-R27-005-03: DELETE 后 GET 404；list 不含。"""
    created = client.post(
        "/api/v1/query/bindings",
        json={
            "name": "Del",
            "dataSourceId": str(query_seed["ds_id"]),
            "mode": "sql",
            "sql": "SELECT 1",
        },
        headers=auth_headers,
    ).json()
    bid = created["id"]
    assert client.delete(f"/api/v1/query/bindings/{bid}", headers=auth_headers).status_code == 204
    assert client.get(f"/api/v1/query/bindings/{bid}", headers=auth_headers).status_code == 404
    listed = client.get("/api/v1/query/bindings", headers=auth_headers).json()["items"]
    assert all(item["id"] != bid for item in listed)


def test_binding_execute_after_delete_404(client, query_seed, auth_headers):
    """T-Q-R27-005-04: DELETE 后 bindingId execute → 404 BINDING_NOT_FOUND。"""
    created = client.post(
        "/api/v1/query/bindings",
        json={
            "name": "ExecDel",
            "dataSourceId": str(query_seed["ds_id"]),
            "mode": "sql",
            "sql": "SELECT 1",
        },
        headers=auth_headers,
    ).json()
    bid = created["id"]
    client.delete(f"/api/v1/query/bindings/{bid}", headers=auth_headers)
    resp = client.post(
        "/api/v1/query/execute",
        json={"bindingId": bid},
        headers=auth_headers,
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "BINDING_NOT_FOUND"


def test_binding_execute_soft_deleted_datasource_404(client, query_seed, auth_headers, meta_session):
    """T-Q-R27-005-05: 数据源软删后 binding execute → 404 DATASOURCE_NOT_FOUND。"""
    created = client.post(
        "/api/v1/query/bindings",
        json={
            "name": "SoftDS",
            "dataSourceId": str(query_seed["ds_id"]),
            "mode": "sql",
            "sql": "SELECT 1",
        },
        headers=auth_headers,
    ).json()
    from datetime import datetime, timezone

    row = meta_session.get(DataSource, query_seed["ds_id"])
    row.deleted_at = datetime.now(timezone.utc)
    meta_session.commit()
    resp = client.post(
        "/api/v1/query/execute",
        json={"bindingId": created["id"]},
        headers=auth_headers,
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "DATASOURCE_NOT_FOUND"


# --- T-Q-R27-006: RLS admin bypass ---


@pytest.fixture
def mock_rls():
    yield


def test_rls_admin_bypass_no_predicate(mock_rls, meta_session):
    """T-Q-R27-006-01: admin 执行不追加 WHERE (1=0)。"""
    user = UserContext(id="dev", username="dev", roles=["admin"])
    with patch("app.query.rls.guard.prepare_query_rls", return_value="1=0") as mocked:
        out = apply_rls_to_sql(meta_session, user, "SELECT 1", rls_config={})
    assert out == "SELECT 1"
    mocked.assert_not_called()


def test_rls_viewer_no_org_still_empty(mock_rls, meta_session):
    """T-Q-R27-006-02: viewer 无 org → 仍 1=0（回归 T-Q-041 语义）。"""
    user = UserContext(id="v", username="v", roles=["viewer"])
    with patch("app.query.rls.guard.prepare_query_rls", return_value="1=0"):
        out = apply_rls_to_sql(meta_session, user, "SELECT 1", rls_config={})
    assert "1=0" in out


def test_rls_admin_viewer_dual_role_bypass(mock_rls, meta_session):
    """T-Q-R27-006-03: admin+viewer 双角色 → bypass。"""
    user = UserContext(id="dev", username="dev", roles=["admin", "viewer"])
    with patch("app.query.rls.guard.prepare_query_rls", return_value="1=0") as mocked:
        out = apply_rls_to_sql(meta_session, user, "SELECT * FROM t", rls_config={})
    assert out == "SELECT * FROM t"
    mocked.assert_not_called()


def test_rls_multidim_fragment_merge(mock_rls, meta_session):
    """T-Q-R27-006-04: 多维 column_by_dimension_id fragment 含 AND 合并。"""
    user = UserContext(id="v", username="v", roles=["viewer"])
    with patch("app.query.rls.guard.prepare_query_rls", return_value="dim_a = 1 AND dim_b = 2"):
        out = apply_rls_to_sql(
            meta_session, user, "SELECT 1 FROM t WHERE x=1",
            rls_config={"column_by_dimension_id": {"d1": "dim_a"}},
        )
    assert "AND (dim_a = 1 AND dim_b = 2)" in out


def test_rls_clickhouse_execute_chain(mock_pool, query_seed, meta_session):
    """T-Q-R27-006-05: clickhouse + RLS 链 mock execute 200；apply_rls_to_sql 调用一次。"""
    ds = _create_ch_ds()
    user = UserContext(id="dev", username="dev", roles=["admin"])
    pool = mock_pool(["id"], [[1]])
    with patch("app.query.executor.apply_rls_to_sql", wraps=apply_rls_to_sql) as spy:
        with patch.object(QueryExecutor, "_connector_kwargs", return_value=(MagicMock(), {}, 2)):
            with patch("app.query.executor.pool_manager.pooled_connection", pool):
                result = QueryExecutor().execute_sql(
                    meta_session, user, ds.id, "SELECT 1", limit=10, apply_rls=True,
                )
    assert result.row_count == 1
    assert spy.call_count == 1


def test_rls_invisible_datasource_403(client, query_seed, viewer_headers):
    """T-Q-R27-006-06: 不可见 dataSource → 403（回归 T-Q-042）。"""
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
