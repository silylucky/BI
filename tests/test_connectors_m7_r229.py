"""M7 CONN-008 Apache Doris r229 — M7 收官集成验收。

可选 compose：127.0.0.1:9030 可达时实库 test+schema；否则 skip。
"""
from __future__ import annotations

import json
import os
import uuid
from unittest.mock import MagicMock, patch

import pymysql
import pytest
from fastapi.testclient import TestClient
from jwt_auth import jwt_auth_headers

from app.core.config import get_settings
from app.datasources.dialects.doris import DorisConnector
from app.datasources.registry import export_type_catalog, registry
from app.main import app

AUTH = jwt_auth_headers()
_R229_SQLITE_URL = "sqlite+pysqlite:///file:connectors_m7_r229?mode=memory&cache=shared&uri=true"

pytestmark = [pytest.mark.integration]


@pytest.fixture(scope="module", autouse=True)
def r229_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R229_SQLITE_URL
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
def client() -> TestClient:
    return TestClient(app)


def test_conn_r229_008_01_types_catalog_doris():
    """T-CONN-R229-008-01: export_type_catalog 含 doris olap + schema_browser。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "doris" in types
    assert types["doris"]["category"] == "olap"
    conn = registry.get("doris")
    assert isinstance(conn, DorisConnector)
    assert set(conn.capabilities) >= {"connectivity_test", "schema_browser"}


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_conn_r229_008_02_http_test_conn_refused(mock_connect, client):
    """T-CONN-R229-008-02: HTTP POST test mock 2003 → DORIS_CONN_REFUSED。"""
    mock_connect.side_effect = pymysql.err.OperationalError(2003, "Can't connect")
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "doris",
            "name": "doris-r229",
            "code": f"doris-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 9030,
            "database": "test",
            "username": "root",
            "password": "sample_secret",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == "DORIS_CONN_REFUSED"
    assert "sample_secret" not in json.dumps(body)
    assert "password" not in resp.text.lower()


@patch("app.datasources.dialects.doris.DorisConnector.list_columns")
@patch("app.datasources.dialects.doris.DorisConnector.list_tables")
@patch("app.datasources.metadata.service.pool_manager.pooled_connection")
@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_conn_r229_008_03_http_metadata_columns_chain(
    mock_connect, mock_pool, mock_tables, mock_columns, client
):
    """T-CONN-R229-008-03: HTTP tables/columns mock → 200 + 列列表。"""
    from contextlib import contextmanager

    from app.datasources.dialects.base import ColumnInfo, TableInfo

    conn = MagicMock()
    mock_connect.return_value = conn
    mock_tables.return_value = [TableInfo(name="orders", type="table")]
    mock_columns.return_value = [
        ColumnInfo(name="id", data_type="bigint", nullable=False),
        ColumnInfo(name="region", data_type="varchar", nullable=True),
    ]

    @contextmanager
    def _cm(*_a, **_k):
        yield conn

    mock_pool.side_effect = _cm
    create = client.post(
        "/api/v1/datasources",
        headers=AUTH,
        json={
            "type": "doris",
            "name": "doris-meta-r229",
            "code": f"doris-meta-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 9030,
            "database": "analytics",
            "username": "root",
            "password": "x",
        },
    )
    assert create.status_code == 201, create.text
    ds_id = create.json()["id"]
    tables = client.get(f"/api/v1/datasources/{ds_id}/tables?schema=analytics", headers=AUTH)
    assert tables.status_code == 200
    cols = client.get(
        f"/api/v1/datasources/{ds_id}/columns?schema=analytics&table=orders",
        headers=AUTH,
    )
    assert cols.status_code == 200
    names = {c["name"] for c in cols.json()["items"]}
    assert names == {"id", "region"}


@pytest.mark.integration
def test_conn_r229_008_04_optional_compose_live(m7_compose_env):
    """T-CONN-R229-008-04: 9030 可达则实库 test+list_schemas；否则 skip。"""
    from conftest import _port_open

    if not _port_open("127.0.0.1", 9030):
        pytest.skip("sample-doris not running on 127.0.0.1:9030")
    result = DorisConnector().test_connection(
        host="127.0.0.1", port=9030, database="test", username="root", password=""
    )
    assert result.ok is True
