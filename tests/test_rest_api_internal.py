"""REST API 连接器进程内样例 API 分发。"""

import httpx
import pytest

from app.datasources.dialects.rest_api import RestApiConnector
from app.datasources.dialects.errors import REST_API_AUTH_FAILED
from app.query.schemas import QueryError


def test_execute_native_query_uses_internal_sample_api_without_http() -> None:
    connector = RestApiConnector()
    client = httpx.Client(base_url="http://127.0.0.1:8000")
    try:
        columns, rows, truncated = connector.execute_native_query(
            client,
            body={"path": "/sample-api/orders"},
            limit=10,
        )
    finally:
        client.close()
    assert truncated is False
    assert "id" in columns
    assert len(rows) == 4


def test_test_connection_uses_internal_sample_api_health() -> None:
    connector = RestApiConnector()
    result = connector.test_connection(
        host="http://127.0.0.1:8000",
        port=8000,
        database="/sample-api/health",
        username="none",
        password="",
    )
    assert result.ok is True


def test_internal_sample_api_protected_orders_requires_auth() -> None:
    connector = RestApiConnector()
    client = httpx.Client(base_url="http://127.0.0.1:8000")
    try:
        with pytest.raises(QueryError) as exc_info:
            connector.execute_native_query(
                client,
                body={"path": "/sample-api/protected/orders"},
                limit=10,
            )
    finally:
        client.close()
    assert exc_info.value.code == REST_API_AUTH_FAILED
