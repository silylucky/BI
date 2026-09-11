"""Phase 2: sqlite / sqlserver / oracle SQL dialect registration (CONN-Q-10~12)."""

from __future__ import annotations

import sqlite3

import pytest

from app.datasources.registry import export_type_catalog
from app.query.capabilities import is_query_capable, is_sql_query_capable, resolve_query_mode_for_connector
from app.query.dialects import get_sql_dialect
from app.query.dialects.base import UnsupportedDialectError
from app.query.readonly import assert_readonly_sql
from app.query.table import build_table_sql

_PHASE2_TYPES = ("sqlite", "sqlserver", "oracle")


@pytest.mark.parametrize("connector_type", _PHASE2_TYPES)
def test_phase2_get_sql_dialect_registered(connector_type: str) -> None:
    dialect = get_sql_dialect(connector_type)
    assert dialect.connector_type == connector_type
    assert is_sql_query_capable(connector_type)
    assert is_query_capable(connector_type)
    assert resolve_query_mode_for_connector(connector_type) == "sql"


def test_phase2_sqlite_quote_and_limit() -> None:
    d = get_sql_dialect("sqlite")
    assert d.quote_identifier("col") == '"col"'
    sql = d.wrap_limit("SELECT 1", limit=10, offset=3)
    assert "LIMIT 10" in sql and "OFFSET 3" in sql
    table_sql = d.build_table_select("main", "sales", limit=5, offset=0)
    assert '"main"."sales"' in table_sql
    assert_readonly_sql(table_sql)


def test_phase2_sqlserver_quote_and_pagination() -> None:
    d = get_sql_dialect("sqlserver")
    assert d.quote_identifier("col") == "[col]"
    sql = d.wrap_limit("SELECT 1", limit=10, offset=2)
    assert "OFFSET 2 ROWS" in sql
    assert "FETCH NEXT 10 ROWS ONLY" in sql
    table_sql = d.build_table_select("dbo", "orders", limit=20, offset=0)
    assert "[dbo].[orders]" in table_sql
    assert_readonly_sql(table_sql)


def test_phase2_oracle_quote_and_pagination() -> None:
    d = get_sql_dialect("oracle")
    assert d.quote_identifier("col") == '"col"'
    sql = d.wrap_limit("SELECT 1 FROM DUAL", limit=5, offset=1)
    assert "OFFSET 1 ROWS" in sql
    assert "FETCH NEXT 5 ROWS ONLY" in sql
    table_sql = d.build_table_select("HR", "EMPLOYEES", limit=50, offset=0)
    assert '"HR"."EMPLOYEES"' in table_sql
    assert_readonly_sql(table_sql)


@pytest.mark.parametrize("connector_type", _PHASE2_TYPES)
def test_phase2_build_table_sql(connector_type: str) -> None:
    sql = build_table_sql(connector_type, "public", "t", limit=10, offset=0)
    assert "SELECT" in sql.upper()
    assert_readonly_sql(sql)


def test_phase2_export_type_catalog_query_capable() -> None:
    by_type = {item["type"]: item for item in export_type_catalog()}
    for t in _PHASE2_TYPES:
        assert by_type[t]["queryCapable"] is True
        assert by_type[t]["queryMode"] == "sql"


def test_phase2_dm_uses_oracle_dialect_alias() -> None:
    dialect = get_sql_dialect("dm")
    assert dialect.connector_type == "oracle"
    assert is_query_capable("dm")


def test_phase2_sqlite_execute_integration(tmp_path) -> None:
    db_path = tmp_path / "phase2.db"
    conn = sqlite3.connect(db_path)
    conn.execute("CREATE TABLE items (id INTEGER, name TEXT)")
    conn.executemany("INSERT INTO items VALUES (?, ?)", [(1, "a"), (2, "b")])
    conn.commit()
    conn.close()

    sql = build_table_sql("sqlite", "main", "items", limit=10, offset=0)
    ro_conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    try:
        cur = ro_conn.cursor()
        cur.execute(sql)
        columns = [c[0] for c in cur.description]
        rows = cur.fetchall()
    finally:
        ro_conn.close()
    assert columns == ["id", "name"]
    assert len(rows) == 2
