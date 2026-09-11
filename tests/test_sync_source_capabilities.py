from app.ingestion.sync_source_capabilities import (
    is_sync_fetch_implemented,
    is_sync_source_capable,
    resolve_sync_fetch_mode,
)


def test_sync_capable_matches_query_capable_catalog():
    for connector in (
        "mysql",
        "postgresql",
        "csv",
        "hive",
        "trino",
        "clickhouse",
        "oracle",
        "influxdb",
        "tdengine",
        "dm",
    ):
        assert is_sync_source_capable(connector)
        assert is_sync_fetch_implemented(connector)


def test_sync_fetch_mode():
    assert resolve_sync_fetch_mode("tidb") == "sql"
    assert resolve_sync_fetch_mode("mongodb") == "native"
    assert resolve_sync_fetch_mode("hive") == "sql"
    assert resolve_sync_fetch_mode("influxdb") == "native"


def test_sync_fetch_implemented_matrix():
    assert is_sync_fetch_implemented("mysql")
    assert is_sync_fetch_implemented("kingbase")
    assert is_sync_fetch_implemented("csv")
    assert is_sync_fetch_implemented("clickhouse")
    assert is_sync_fetch_implemented("hive")
