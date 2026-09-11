"""Phase 1: csv / excel / rest_api native query wire-up (CONN-Q-22~24)."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from app.datasources.dialects.csv_file import CsvFileConnector
from app.datasources.dialects.rest_api import RestApiConnector
from app.query.capabilities import (
    NATIVE_OFFSET_TYPES,
    NATIVE_QUERY_CAPABLE,
    is_native_query_capable,
    is_query_capable,
    resolve_query_mode_for_connector,
)
from app.query.native.executor import NativeQueryExecutor


def test_phase1_native_query_capable_includes_file_and_api() -> None:
    for t in ("csv", "excel", "rest_api"):
        assert t in NATIVE_QUERY_CAPABLE
        assert is_native_query_capable(t)
        assert is_query_capable(t)
        assert resolve_query_mode_for_connector(t) == "native"


def test_phase1_influx_and_tdengine_query_capable() -> None:
    assert is_query_capable("influxdb")
    assert is_query_capable("tdengine")
    assert resolve_query_mode_for_connector("influxdb") == "native"
    assert resolve_query_mode_for_connector("tdengine") == "sql"


def test_phase1_native_offset_types() -> None:
    assert {"csv", "excel", "rest_api", "mongodb"}.issubset(NATIVE_OFFSET_TYPES)


def test_phase1_csv_native_execute_via_connector(tmp_path: Path) -> None:
    csv_path = tmp_path / "sample.csv"
    csv_path.write_text("id,name\n1,alice\n2,bob\n", encoding="utf-8")
    conn = CsvFileConnector().open_connection(
        host=str(csv_path), port=1, database="", username="", password="",
    )
    cols, rows, truncated = CsvFileConnector().execute_native_query(
        conn, body={"table": "data"}, limit=5, offset=0,
    )
    assert "id" in cols
    assert len(rows) == 2
    assert truncated is False


@patch("app.datasources.dialects.rest_api.httpx.Client")
def test_phase1_rest_api_native_execute_list_payload(mock_client_cls: MagicMock) -> None:
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.is_success = True
    mock_resp.json.return_value = [{"id": 1, "name": "a"}, {"id": 2, "name": "b"}]
    mock_client = MagicMock()
    mock_client.request.return_value = mock_resp
    mock_client_cls.return_value = mock_client

    connector = RestApiConnector()
    client = connector.open_connection(host="https://api.example.com", port=443, database="", username="", password="")
    cols, rows, _ = connector.execute_native_query(
        client, body={"path": "/items"}, limit=10, offset=0,
    )
    assert "id" in cols
    assert len(rows) == 2


def test_phase1_executor_dispatches_csv_with_offset() -> None:
    connector = MagicMock()
    connector.execute_native_query.return_value = (["c"], [[1]], False)
    row = MagicMock()
    row.type = "csv"
    row.database = ""
    cols, rows, truncated = NativeQueryExecutor._run_native_query(
        connector, row, Path("/tmp/x.csv"), body={}, index=None, limit=10, offset=2,
    )
    connector.execute_native_query.assert_called_once_with(
        Path("/tmp/x.csv"), body={}, limit=10, offset=2,
    )
    assert cols == ["c"]
    assert rows == [[1]]
    assert truncated is False
