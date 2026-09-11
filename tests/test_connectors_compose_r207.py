from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.datasources import register_builtin_dialects
from app.datasources.dialects.mysql import MysqlConnector
from app.datasources.dialects.postgres import PostgresConnector
from app.datasources.registry import registry
from app.main import app

pytestmark = pytest.mark.integration

_DS_SQLITE_URL = "sqlite+pysqlite:///file:conn_r207_test?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def ds_r207_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _DS_SQLITE_URL
    get_settings.cache_clear()
    from app.auth.models import get_meta_engine as auth_get_meta_engine
    from app.datasources.models import Base, get_meta_engine
    from app.auth.models import Base as AuthBase

    get_meta_engine.cache_clear()
    auth_get_meta_engine.cache_clear()
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    AuthBase.metadata.create_all(engine)
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


def _mysql_payload(code: str, env: dict) -> dict:
    return {
        "name": f"MySQL Compose {code}",
        "code": code,
        "type": "mysql",
        "host": env["host"],
        "port": env["port"],
        "database": env["database"],
        "username": env["username"],
        "password": env["password"],
    }


def _pg_payload(code: str, env: dict) -> dict:
    return {
        "name": f"PG Compose {code}",
        "code": code,
        "type": "postgresql",
        "host": env["host"],
        "port": env["port"],
        "database": env["database"],
        "username": env["username"],
        "password": env["password"],
    }


def test_conn_r207_m01_mysql_test_connection(connector_compose_env):
    """T-CONN-R207-M01: MysqlConnector.test_connection against compose."""
    env = connector_compose_env["mysql"]
    result = MysqlConnector().test_connection(**env)
    assert result.ok is True
    assert result.latency_ms is not None
    assert result.latency_ms >= 0


def test_conn_r207_m02_mysql_list_schemas(connector_compose_env):
    """T-CONN-R207-M02: list_schemas contains sample_db."""
    env = connector_compose_env["mysql"]
    connector = MysqlConnector()
    conn = connector.open_connection(**env)
    try:
        names = [s.name for s in connector.list_schemas(conn)]
    finally:
        conn.close()
    assert "sample_db" in names


def test_conn_r207_m03_mysql_list_tables(connector_compose_env):
    """T-CONN-R207-M03: list_tables contains dirty_orders."""
    env = connector_compose_env["mysql"]
    connector = MysqlConnector()
    conn = connector.open_connection(**env)
    try:
        tables = [t.name for t in connector.list_tables(conn, "sample_db")]
    finally:
        conn.close()
    assert "dirty_orders" in tables


def test_conn_r207_m04_mysql_list_columns(connector_compose_env):
    """T-CONN-R207-M04: list_columns on dirty_orders."""
    env = connector_compose_env["mysql"]
    connector = MysqlConnector()
    conn = connector.open_connection(**env)
    try:
        cols = [c.name for c in connector.list_columns(conn, "sample_db", "dirty_orders")]
    finally:
        conn.close()
    assert "id" in cols
    assert "product_name" in cols


def test_conn_r207_m05_mysql_http_crud_test_schemas(client, auth_headers, connector_compose_env):
    """T-CONN-R207-M05: POST datasource → test → GET schemas."""
    code = f"mysql-r207-{uuid.uuid4().hex[:8]}"
    created = client.post(
        "/api/v1/datasources",
        json=_mysql_payload(code, connector_compose_env["mysql"]),
        headers=auth_headers,
    )
    assert created.status_code == 201
    ds_id = created.json()["id"]

    tested = client.post(f"/api/v1/datasources/{ds_id}/test", headers=auth_headers)
    assert tested.status_code == 200
    assert tested.json()["ok"] is True

    schemas = client.get(f"/api/v1/datasources/{ds_id}/schemas", headers=auth_headers)
    assert schemas.status_code == 200
    assert len(schemas.json()["items"]) > 0


def test_conn_r207_p01_postgres_test_connection(connector_compose_env):
    """T-CONN-R207-P01: PostgresConnector.test_connection against compose."""
    env = connector_compose_env["postgresql"]
    result = PostgresConnector().test_connection(**env)
    assert result.ok is True


def test_conn_r207_p02_postgres_list_schemas(connector_compose_env):
    """T-CONN-R207-P02: list_schemas has public, excludes pg_catalog."""
    env = connector_compose_env["postgresql"]
    connector = PostgresConnector()
    conn = connector.open_connection(**env)
    try:
        names = [s.name for s in connector.list_schemas(conn)]
    finally:
        conn.close()
    assert "public" in names
    assert "pg_catalog" not in names


def test_conn_r207_p03_postgres_http_metadata_chain(client, auth_headers, connector_compose_env):
    """T-CONN-R207-P03: HTTP schemas → tables → columns 200."""
    code = f"pg-r207-{uuid.uuid4().hex[:8]}"
    created = client.post(
        "/api/v1/datasources",
        json=_pg_payload(code, connector_compose_env["postgresql"]),
        headers=auth_headers,
    )
    assert created.status_code == 201
    ds_id = created.json()["id"]

    assert client.post(f"/api/v1/datasources/{ds_id}/test", headers=auth_headers).json()["ok"] is True

    schemas = client.get(f"/api/v1/datasources/{ds_id}/schemas", headers=auth_headers)
    assert schemas.status_code == 200
    schema_name = schemas.json()["items"][0]["name"]

    tables = client.get(
        f"/api/v1/datasources/{ds_id}/tables",
        params={"schema": schema_name},
        headers=auth_headers,
    )
    assert tables.status_code == 200

    if tables.json()["items"]:
        table_name = tables.json()["items"][0]["name"]
        cols = client.get(
            f"/api/v1/datasources/{ds_id}/columns",
            params={"schema": schema_name, "table": table_name},
            headers=auth_headers,
        )
        assert cols.status_code == 200
    else:
        cols = client.get(
            f"/api/v1/datasources/{ds_id}/columns",
            params={"schema": schema_name, "table": "nonexistent_table_xyz"},
            headers=auth_headers,
        )
        assert cols.status_code in (200, 404)
