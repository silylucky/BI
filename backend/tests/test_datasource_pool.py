from __future__ import annotations

import threading
import uuid
from unittest.mock import MagicMock

import pytest

from app.datasources.pool import DataSourcePoolManager


class _FlakyConnector:
    def __init__(self) -> None:
        self.open_attempts = 0

    def open_connection(self, **_kwargs):
        self.open_attempts += 1
        raise ConnectionError("db down")


class _PingConnector:
    def __init__(self) -> None:
        self.open_count = 0
        self._conns: list[MagicMock] = []

    def open_connection(self, **_kwargs):
        self.open_count += 1
        conn = MagicMock()
        conn.ping.return_value = None
        self._conns.append(conn)
        return conn


def test_pooled_connection_releases_slot_when_open_fails() -> None:
    pool = DataSourcePoolManager()
    ds_id = uuid.uuid4()
    connector = _FlakyConnector()

    with pytest.raises(ConnectionError):
        with pool.pooled_connection(ds_id, connector=connector, connect_kwargs={}, pool_size=2):
            pass

    with pytest.raises(ConnectionError):
        with pool.pooled_connection(ds_id, connector=connector, connect_kwargs={}, pool_size=2):
            pass

    assert connector.open_attempts == 2


def test_pooled_connection_returns_connection_to_queue() -> None:
    pool = DataSourcePoolManager()
    ds_id = uuid.uuid4()
    connector = MagicMock()
    conn = MagicMock()
    conn.ping.return_value = None
    connector.open_connection.return_value = conn

    with pool.pooled_connection(ds_id, connector=connector, connect_kwargs={}, pool_size=2) as first:
        assert first is conn

    with pool.pooled_connection(ds_id, connector=connector, connect_kwargs={}, pool_size=2) as second:
        assert second is conn

    assert connector.open_connection.call_count == 1


def test_pooled_connection_discards_cross_thread_reuse() -> None:
    pool = DataSourcePoolManager()
    ds_id = uuid.uuid4()
    connector = _PingConnector()
    barrier = threading.Barrier(2)
    errors: list[Exception] = []

    def borrow_in_other_thread() -> None:
        try:
            barrier.wait(timeout=5)
            with pool.pooled_connection(ds_id, connector=connector, connect_kwargs={}, pool_size=2):
                pass
        except Exception as exc:
            errors.append(exc)

    worker = threading.Thread(target=borrow_in_other_thread)
    worker.start()
    with pool.pooled_connection(ds_id, connector=connector, connect_kwargs={}, pool_size=2):
        barrier.wait(timeout=5)
    worker.join(timeout=5)

    assert not errors
    assert connector.open_count == 2


def test_evicted_pool_does_not_reuse_connections() -> None:
    pool = DataSourcePoolManager()
    ds_id = uuid.uuid4()
    connector = MagicMock()
    first_conn = MagicMock()
    first_conn.ping.return_value = None
    second_conn = MagicMock()
    second_conn.ping.return_value = None
    connector.open_connection.side_effect = [first_conn, second_conn]

    with pool.pooled_connection(ds_id, connector=connector, connect_kwargs={}, pool_size=2):
        pass

    pool.evict_pool(ds_id)

    with pool.pooled_connection(ds_id, connector=connector, connect_kwargs={}, pool_size=2) as borrowed:
        assert borrowed is second_conn

    assert connector.open_connection.call_count == 2
