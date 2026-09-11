from __future__ import annotations

import queue
import threading
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Any

from app.datasources.dialects.base import DialectConnector

DEFAULT_POOL_SIZE = 4
_POOL_WAIT_SECONDS = 30.0
_POOL_OWNER_ATTR = "_vs_pool_owner_thread"


@dataclass
class _PoolEntry:
    queue: queue.Queue[Any] = field(default_factory=queue.Queue)
    pool_size: int = DEFAULT_POOL_SIZE
    connect_count: int = 0


def _tag_pool_owner(conn: Any) -> None:
    setattr(conn, _POOL_OWNER_ATTR, threading.get_ident())


def _owns_current_thread(conn: Any) -> bool:
    owner = getattr(conn, _POOL_OWNER_ATTR, None)
    return owner is None or owner == threading.get_ident()


def _ping_connection(conn: Any) -> bool:
    ping = getattr(conn, "ping", None)
    if ping is None:
        return True
    try:
        ping(reconnect=False)
        return True
    except Exception:
        return False


def _close_connection(conn: Any) -> None:
    try:
        conn.close()
    except Exception:
        pass


class DataSourcePoolManager:
    def __init__(self) -> None:
        self._entries: dict[uuid.UUID, _PoolEntry] = {}
        self._lock = threading.RLock()

    def active_pool_count(self) -> int:
        with self._lock:
            return len(self._entries)

    def evict_pool(self, data_source_id: uuid.UUID) -> None:
        with self._lock:
            entry = self._entries.pop(data_source_id, None)
        if entry is None:
            return
        while True:
            try:
                conn = entry.queue.get_nowait()
            except queue.Empty:
                break
            _close_connection(conn)

    def _release_connect_slot(self, entry: _PoolEntry) -> None:
        with self._lock:
            entry.connect_count = max(0, entry.connect_count - 1)

    def _discard_pooled_connection(self, entry: _PoolEntry, conn: Any) -> None:
        _close_connection(conn)
        self._release_connect_slot(entry)

    def _accept_pooled_connection(self, conn: Any) -> bool:
        return _owns_current_thread(conn) and _ping_connection(conn)

    def _open_new_connection(
        self,
        entry: _PoolEntry,
        connector: DialectConnector,
        connect_kwargs: dict,
    ) -> tuple[Any, bool]:
        with self._lock:
            can_open = entry.connect_count < entry.pool_size
            if can_open:
                entry.connect_count += 1
        if not can_open:
            return None, False
        conn = connector.open_connection(**connect_kwargs)
        _tag_pool_owner(conn)
        return conn, True

    def _acquire_connection(
        self,
        entry: _PoolEntry,
        connector: DialectConnector,
        connect_kwargs: dict,
    ) -> tuple[Any, bool]:
        """Borrow a pooled connection. Returns (conn, leased_new)."""
        while True:
            try:
                candidate = entry.queue.get_nowait()
            except queue.Empty:
                candidate = None

            if candidate is not None:
                if self._accept_pooled_connection(candidate):
                    return candidate, False
                self._discard_pooled_connection(entry, candidate)
                continue

            conn, leased_new = self._open_new_connection(entry, connector, connect_kwargs)
            if conn is not None:
                return conn, leased_new

            try:
                candidate = entry.queue.get(timeout=_POOL_WAIT_SECONDS)
            except queue.Empty as exc:
                raise TimeoutError(
                    f"datasource connection pool exhausted after {_POOL_WAIT_SECONDS:.0f}s",
                ) from exc

            if self._accept_pooled_connection(candidate):
                return candidate, False
            self._discard_pooled_connection(entry, candidate)

    @contextmanager
    def pooled_connection(
        self,
        data_source_id: uuid.UUID,
        *,
        connector: DialectConnector,
        connect_kwargs: dict,
        pool_size: int = DEFAULT_POOL_SIZE,
    ) -> Iterator[Any]:
        pool_size = max(1, min(pool_size, 10))
        with self._lock:
            entry = self._entries.get(data_source_id)
            if entry is None:
                entry = _PoolEntry(pool_size=pool_size)
                self._entries[data_source_id] = entry
            entry.pool_size = pool_size
        conn = None
        leased_new = False
        pool_broken = False
        try:
            conn, leased_new = self._acquire_connection(entry, connector, connect_kwargs)
            yield conn
        except Exception:
            pool_broken = True
            raise
        finally:
            if conn is not None:
                with self._lock:
                    still_active = self._entries.get(data_source_id) is entry
                if pool_broken:
                    if leased_new:
                        self._release_connect_slot(entry)
                    _close_connection(conn)
                elif not still_active:
                    _close_connection(conn)
                    if leased_new:
                        self._release_connect_slot(entry)
                else:
                    _tag_pool_owner(conn)
                    try:
                        entry.queue.put_nowait(conn)
                    except queue.Full:
                        self._release_connect_slot(entry)
                        _close_connection(conn)
            elif leased_new:
                self._release_connect_slot(entry)


pool_manager = DataSourcePoolManager()
