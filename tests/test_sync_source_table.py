"""sync_source_table 校验。"""

import pytest

from app.ingestion.sync_source_table import (
    SyncSourceTableError,
    normalize_rest_api_path,
    validate_sync_source_table,
)


def test_validate_rest_api_path_accepts_sample_orders() -> None:
    assert validate_sync_source_table("rest_api", "/sample-api/orders") == "/sample-api/orders"


def test_validate_rest_api_path_normalizes_without_leading_slash() -> None:
    assert validate_sync_source_table("rest_api", "sample-api/health") == "/sample-api/health"


def test_validate_rest_api_path_rejects_empty() -> None:
    with pytest.raises(SyncSourceTableError):
        validate_sync_source_table("rest_api", "   ")


def test_validate_mysql_table_still_identifier() -> None:
    assert validate_sync_source_table("mysql", "dirty_orders") == "dirty_orders"


def test_validate_mysql_table_rejects_slashes() -> None:
    with pytest.raises(SyncSourceTableError):
        validate_sync_source_table("mysql", "/sample-api/orders")


def test_normalize_rest_api_path() -> None:
    assert normalize_rest_api_path("orders") == "/orders"
