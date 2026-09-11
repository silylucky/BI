"""R1.5 connector query align — SQL dialect aliases + queryCapable catalog."""

from __future__ import annotations

import pytest

from app.datasources.registry import export_type_catalog
from app.query.capabilities import (
    CONNECTOR_SQL_DIALECT_ALIASES,
    is_query_capable,
    is_sql_query_capable,
    resolve_sql_dialect_type,
)
from app.query.dialects import get_sql_dialect
from app.query.dialects.base import UnsupportedDialectError
from app.query.native.guard import resolve_query_mode

_MYSQL_ALIASES = ("mariadb", "tidb", "starrocks", "doris", "oceanbase", "gbase")
_PG_ALIASES = ("kingbase", "gaussdb", "redshift", "timescaledb")


@pytest.mark.parametrize("connector_type", _MYSQL_ALIASES)
def test_r15_mysql_family_sql_dialect_alias(connector_type: str) -> None:
    assert resolve_sql_dialect_type(connector_type) == "mysql"
    dialect = get_sql_dialect(connector_type)
    assert dialect.connector_type == "mysql"
    assert is_sql_query_capable(connector_type)
    assert resolve_query_mode(connector_type) == "sql"


@pytest.mark.parametrize("connector_type", _PG_ALIASES)
def test_r15_postgres_family_sql_dialect_alias(connector_type: str) -> None:
    assert resolve_sql_dialect_type(connector_type) == "postgresql"
    dialect = get_sql_dialect(connector_type)
    assert dialect.connector_type == "postgresql"
    assert is_sql_query_capable(connector_type)
    assert resolve_query_mode(connector_type) == "sql"


def test_r15_timescaledb_not_native_routing() -> None:
    """CONN-Q-19: timescaledb category=timeseries but must route sql via PG alias."""
    assert resolve_query_mode("timescaledb") == "sql"


@pytest.mark.parametrize("connector_type", ("sqlite", "sqlserver", "oracle"))
def test_r15_phase2_sql_dialect_query_capable(connector_type: str) -> None:
    dialect = get_sql_dialect(connector_type)
    assert dialect.connector_type == connector_type
    assert is_sql_query_capable(connector_type)
    assert resolve_query_mode(connector_type) == "sql"


def test_r15_dm_query_capable():
    dialect = get_sql_dialect("dm")
    assert dialect.connector_type == "oracle"
    assert is_sql_query_capable("dm")
    assert is_query_capable("dm")


def test_r15_export_type_catalog_query_capable_flags() -> None:
    by_type = {item["type"]: item for item in export_type_catalog()}
    assert by_type["mysql"]["queryCapable"] is True
    assert by_type["mysql"]["queryMode"] == "sql"
    assert by_type["mariadb"]["queryCapable"] is True
    assert by_type["mongodb"]["queryMode"] == "native"
    assert by_type["hive"]["queryCapable"] is True
    assert by_type["hive"]["queryMode"] == "sql"
    assert by_type["csv"]["queryCapable"] is True
    assert by_type["csv"]["queryMode"] == "native"
    assert by_type["excel"]["queryCapable"] is True
    assert by_type["rest_api"]["queryCapable"] is True
    assert by_type["influxdb"]["queryCapable"] is True
    assert by_type["clickhouse"]["syncFetchImplemented"] is True


def test_r15_alias_registry_covers_conn_q_01_to_09_and_19() -> None:
    expected = set(_MYSQL_ALIASES) | set(_PG_ALIASES) | {"dm", "impala", "presto"}
    assert expected == set(CONNECTOR_SQL_DIALECT_ALIASES.keys())
