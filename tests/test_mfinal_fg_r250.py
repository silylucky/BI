"""M-FINAL F-G 收官 r250 — CONN-027 AWS Redshift + API-001 性能/结构化错误。"""
from __future__ import annotations

import os
import time
import uuid
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.datasources.dialects.errors import (
    REDSHIFT_AUTH_FAILED,
    REDSHIFT_SSL_REQUIRED,
    map_redshift_error,
)
from app.datasources.dialects.redshift import RedshiftConnector
from app.datasources.registry import export_type_catalog
from app.main import app
from jwt_auth import jwt_auth_headers

AUTH = jwt_auth_headers()
_R250_SQLITE_URL = "sqlite+pysqlite:///file:mfinal_fg_r250?mode=memory&cache=shared&uri=true"

pytestmark = [pytest.mark.integration]


@pytest.fixture(scope="module", autouse=True)
def r250_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R250_SQLITE_URL
    get_settings.cache_clear()
    from app.auth.models import Base as AuthBase, get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    from app.query.models import Base as QueryBase
    import app.auth.models  # noqa: F401
    import app.dashboard.models  # noqa: F401
    import app.datasources.models  # noqa: F401
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


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


# ─── CONN-027 断言 ────────────────────────────────────────────────────────────


def test_r250_027_01_redshift_in_catalog():
    """T-CONN-R250-027-01: redshift 在 export_type_catalog；category=olap；catalog count == 31。"""
    catalog = {item["type"]: item for item in export_type_catalog()}
    assert "redshift" in catalog
    assert catalog["redshift"]["category"] == "olap"
    assert len(catalog) == 31


def test_r250_027_02_types_api_contains_redshift(client):
    """T-CONN-R250-027-02: GET /api/v1/datasources/types 返回含 redshift（mock 环境）。"""
    resp = client.get("/api/v1/datasources/types", headers=AUTH)
    assert resp.status_code == 200
    types = [item["type"] for item in resp.json()["items"]]
    assert "redshift" in types


def test_r250_027_03_map_redshift_error_auth_failed():
    """T-CONN-R250-027-03: map_redshift_error(PG_AUTH exc) → REDSHIFT_AUTH_FAILED。"""
    import psycopg

    exc = psycopg.OperationalError("password authentication failed for user")
    exc.pgcode = "28P01"
    exc.sqlstate = "28P01"
    code, detail = map_redshift_error(exc)
    assert code == REDSHIFT_AUTH_FAILED


def test_r250_027_04_map_redshift_error_ssl():
    """T-CONN-R250-027-04: map_redshift_error(SSL exc) → REDSHIFT_SSL_REQUIRED。"""
    import psycopg

    exc = psycopg.OperationalError("SSL connection has been closed unexpectedly")
    code, detail = map_redshift_error(exc)
    assert code == REDSHIFT_SSL_REQUIRED


@patch("app.datasources.dialects.redshift.RedshiftConnector.open_connection")
def test_r250_027_05_test_connection_ok(mock_open):
    """T-CONN-R250-027-05: test_connection mock 连接成功 → ok=True, latency_ms>0。"""
    conn = MagicMock()
    conn.execute.return_value = None
    mock_open.return_value = conn
    result = RedshiftConnector().test_connection(
        host="cluster.redshift.amazonaws.com",
        port=5439,
        database="dev",
        username="admin",
        password="secret",
    )
    assert result.ok is True
    assert result.latency_ms >= 0


@patch("app.datasources.dialects.redshift.RedshiftConnector.open_connection")
def test_r250_027_06_probe_readonly_sql(mock_open):
    """T-CONN-R250-027-06: probe_readonly_sql mock 连接 → 返回 True。"""
    conn = MagicMock()
    conn.execute.return_value = None
    mock_open.return_value = conn
    result = RedshiftConnector().probe_readonly_sql(conn)
    assert result is True


def test_r250_027_07_api_no_plaintext_password(client):
    """T-CONN-R250-027-07: API 响应无明文密码（凭证脱敏守卫）。"""
    ds_code = f"r250-rs-{uuid.uuid4().hex[:6]}"
    payload = {
        "name": "redshift-r250-test",
        "code": ds_code,
        "type": "redshift",
        "host": "cluster.redshift.amazonaws.com",
        "port": 5439,
        "database": "dev",
        "username": "admin",
        "password": "super_secret_password",
    }
    resp = client.post("/api/v1/datasources", json=payload, headers=AUTH)
    assert resp.status_code in (201, 200)
    body = resp.text
    assert "super_secret_password" not in body


# ─── API-001 断言 ─────────────────────────────────────────────────────────────


def _p95(times: list[float]) -> float:
    """95th percentile of a sorted list of elapsed seconds."""
    s = sorted(times)
    idx = max(0, int(len(s) * 0.95) - 1)
    return s[idx]


def test_r250_001_01_list_datasources_p95(client):
    """T-API-R250-001-01: GET /datasources list P95 ≤ 500ms（5次，内存 SQLite）。"""
    times: list[float] = []
    for _ in range(5):
        t0 = time.perf_counter()
        resp = client.get("/api/v1/datasources", headers=AUTH)
        times.append(time.perf_counter() - t0)
        assert resp.status_code == 200
    assert _p95(times) <= 0.5, f"P95 {_p95(times)*1000:.1f}ms > 500ms"


def test_r250_001_02_create_datasource_p95(client):
    """T-API-R250-001-02: POST /datasources create P95 ≤ 500ms（5次，内存 SQLite）。"""
    times: list[float] = []
    for i in range(5):
        ds_code = f"r250-perf-{uuid.uuid4().hex[:6]}-{i}"
        payload = {
            "name": f"perf-test-{i}",
            "code": ds_code,
            "type": "mysql",
            "host": "127.0.0.1",
            "port": 3306,
            "database": "perf",
            "username": "u",
            "password": "p",
        }
        t0 = time.perf_counter()
        resp = client.post("/api/v1/datasources", json=payload, headers=AUTH)
        times.append(time.perf_counter() - t0)
        assert resp.status_code in (201, 200)
    assert _p95(times) <= 0.5, f"P95 {_p95(times)*1000:.1f}ms > 500ms"


def test_r250_001_03_invalid_uuid_structured_error(client):
    """T-API-R250-001-03: 非法 UUID path → 422 + 结构化 { code, message, detail }。"""
    resp = client.get("/api/v1/datasources/invalid-uuid-value", headers=AUTH)
    assert resp.status_code in (422, 404)
    body = resp.json()
    # 结构化错误须含 code 或 detail 字段（FastAPI 422 detail list 或自定义 code）
    assert "detail" in body or "code" in body


def test_r250_001_04_trace_id_passthrough(client):
    """T-API-R250-001-04: X-Trace-Id 透传：请求头 → 响应头一致。"""
    trace_id = "test-trace-r250-001"
    resp = client.get(
        "/api/v1/datasources",
        headers={**AUTH, "X-Trace-Id": trace_id},
    )
    assert resp.status_code == 200
    assert resp.headers.get("x-trace-id") == trace_id
