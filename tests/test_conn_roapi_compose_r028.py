"""CONN-028 RoAPI compose 集成验收（可选分层 skip）。

前置:
  docker compose --profile roapi up -d roapi
"""
from __future__ import annotations

import httpx
import pytest

from app.datasources.dialects.roapi import RoapiConnector

pytestmark = [pytest.mark.integration]

ROAPI_COMPOSE_BASE = "http://127.0.0.1:8086"
ROAPI_COMPOSE_ENV = {
    "host": ROAPI_COMPOSE_BASE,
    "port": 8086,
    "database": "/api/schema",
    "username": "none",
    "password": "-",
    "timeout_sec": 5.0,
}


def _roapi_compose_available() -> bool:
    try:
        resp = httpx.get(f"{ROAPI_COMPOSE_BASE}/api/schema", timeout=2.0)
        return resp.is_success
    except Exception:
        return False


@pytest.fixture
def roapi_compose_env():
    if not _roapi_compose_available():
        pytest.skip("roapi not running — docker compose --profile roapi up -d roapi")
    return dict(ROAPI_COMPOSE_ENV)


def test_conn_r028_compose_01_test_connection(roapi_compose_env):
    """T-CONN-R028-C01: compose roapi test_connection ok。"""
    result = RoapiConnector().test_connection(**roapi_compose_env)
    assert result.ok is True, result.message


def test_conn_r028_compose_02_list_tables_and_sql(roapi_compose_env):
    """T-CONN-R028-C02: schema 含 demo_orders 且 SQL 可出数。"""
    connector = RoapiConnector()
    conn = connector.open_connection(**roapi_compose_env)
    try:
        tables = connector.list_tables(conn, "roapi")
        names = {t.name for t in tables}
        assert "demo_orders" in names
        column_infos = connector.list_columns(conn, "roapi", "demo_orders")
        col_names = [c.name for c in column_infos]
        assert "id" in col_names and "region" in col_names
        cols, rows, truncated = connector.execute_native_query(
            conn,
            body={"sql": "SELECT id, name FROM demo_orders"},
            limit=5,
        )
        assert "id" in cols and "name" in cols
        assert len(rows) >= 1
        assert truncated is False
    finally:
        conn.close()
