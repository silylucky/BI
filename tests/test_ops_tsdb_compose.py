"""运维时序库 sample-timescaledb compose 集成验收。

前置:
  docker compose up -d sample-timescaledb
  cd backend && python ../scripts/seed-ops-timescaledb.py --days 3 --truncate
"""
from __future__ import annotations

import pytest

from app.datasources.dialects.timescaledb import TimescaledbConnector

pytestmark = [pytest.mark.integration]


@pytest.fixture
def ops_tsdb_env(m11_compose_env):
    env = m11_compose_env["timescaledb"]
    if not env["_available"]:
        pytest.skip("sample-timescaledb not running — docker compose up -d sample-timescaledb")
    return {k: v for k, v in env.items() if k != "_available"}


def test_ops_tsdb_test_connection(ops_tsdb_env):
    result = TimescaledbConnector().test_connection(**ops_tsdb_env)
    assert result.ok is True, result.message


def test_ops_tsdb_lists_hypertables(ops_tsdb_env):
    connector = TimescaledbConnector()
    conn = connector.open_connection(**ops_tsdb_env, connect_timeout_sec=10)
    try:
        tables = connector.list_tables(conn, "public")
        names = {t.name for t in tables}
        assert "host_metrics" in names
        assert "service_metrics" in names
        hypertables = [t for t in tables if t.type == "hypertable"]
        assert len(hypertables) >= 5
    finally:
        conn.close()


def test_ops_tsdb_host_metrics_has_rows(ops_tsdb_env):
    connector = TimescaledbConnector()
    conn = connector.open_connection(**ops_tsdb_env, connect_timeout_sec=10)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM host_metrics")
            count = cur.fetchone()[0]
        assert count > 10_000, f"expected seeded host_metrics, got {count}"
    finally:
        conn.close()


def test_ops_tsdb_dimension_hosts(ops_tsdb_env):
    connector = TimescaledbConnector()
    conn = connector.open_connection(**ops_tsdb_env, connect_timeout_sec=10)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM dim_host")
            count = cur.fetchone()[0]
        assert count >= 30
    finally:
        conn.close()
