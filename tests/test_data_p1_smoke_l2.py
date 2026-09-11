"""DATA-SMOKE L2 — dataSourceId + SQL → dashboard layout → query execute."""
from __future__ import annotations

import os
import time
import uuid
from contextlib import contextmanager
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

_DASH_SQLITE_URL = "sqlite+pysqlite:///file:data_p1_l2?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def l2_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _DASH_SQLITE_URL
    from app.core.config import get_settings
    from app.auth.models import get_meta_engine as auth_get_meta_engine
    from app.datasources.models import Base, get_meta_engine
    from app.dashboard.models import Base as DashBase

    get_settings.cache_clear()
    get_meta_engine.cache_clear()
    auth_get_meta_engine.cache_clear()
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    DashBase.metadata.create_all(engine)
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM dashboards"))
        conn.execute(text("DELETE FROM data_sources"))
    yield
    if previous is None:
        os.environ.pop("DATABASE_URL", None)
    else:
        os.environ["DATABASE_URL"] = previous
    get_settings.cache_clear()
    get_meta_engine.cache_clear()
    auth_get_meta_engine.cache_clear()


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


def _run_l2_chain(client: TestClient, auth_headers: dict[str, str]) -> str:
    """Returns dashboard id after create + layout + execute assertions."""
    from app.datasources.schemas import DataSourceCreate
    from app.datasources.models import get_meta_session
    from app.datasources.service import create_data_source

    session = get_meta_session()
    try:
        ds = create_data_source(
            session,
            DataSourceCreate(
                name=f"L2 Chain DS {uuid.uuid4().hex[:8]}",
                code=f"l2c-{uuid.uuid4().hex[:8]}",
                type="postgresql",
                host="h",
                port=5432,
                database="d",
                username="u",
                password="p",
            ),
        )
        session.commit()
        ds_id = str(ds.id)
    finally:
        session.close()

    with patch("app.query.executor.pool_manager.pooled_connection") as mock_pool:
        mock_pool.side_effect = _mock_pool_cursor(["id"], [(1,)])
        exec_resp = client.post(
            "/api/v1/query/execute",
            json={
                "dataSourceId": ds_id,
                "mode": "sql",
                "sql": "SELECT 1 AS id",
                "limit": 10,
                "rls": {"enabled": False},
            },
            headers=auth_headers,
        )
        assert exec_resp.status_code == 200
        assert len(exec_resp.json()["rows"]) >= 1

        create = client.post(
            "/api/v1/dashboards",
            json={"name": f"L2 Chain {uuid.uuid4().hex[:6]}", "slug": f"l2c-{uuid.uuid4().hex[:6]}"},
            headers=auth_headers,
        )
        assert create.status_code == 201
        dash_id = create.json()["id"]
        layout = {
            "version": 1,
            "widgets": [
                {
                    "id": str(uuid.uuid4()),
                    "type": "chart",
                    "title": "表",
                    "colSpan": 6,
                    "rowSpan": 2,
                    "order": 0,
                    "chartConfig": {
                        "chartType": "table",
                        "dataSourceId": ds_id,
                        "mode": "sql",
                        "sql": "SELECT 1 AS id",
                    },
                }
            ],
            "globalFilters": [],
        }
        put = client.put(
            f"/api/v1/dashboards/{dash_id}/layout",
            json={"layoutJson": layout},
            headers=auth_headers,
        )
        assert put.status_code == 200
        got = client.get(f"/api/v1/dashboards/{dash_id}", headers=auth_headers)
        assert got.json()["layoutJson"]["widgets"][0]["chartConfig"]["dataSourceId"] == ds_id
    return dash_id


@patch("app.query.executor.pool_manager.pooled_connection")
def test_l2_query_execute_returns_rows(mock_pool, client, auth_headers):
    """T-L2-02: POST execute sql → columns + rows >= 1."""
    mock_pool.side_effect = _mock_pool_cursor(["id"], [(1,)])
    dash_id = _run_l2_chain(client, auth_headers)
    assert dash_id


def test_p1_smoke_orchestrator(client, auth_headers):
    """T-L2-06: 编排全链路，耗时 <5s。"""
    started = time.perf_counter()
    _run_l2_chain(client, auth_headers)
    assert time.perf_counter() - started < 5.0
