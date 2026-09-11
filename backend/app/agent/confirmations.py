from __future__ import annotations

import json
import sqlite3
import time
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from threading import RLock
from typing import Any


@dataclass(frozen=True)
class PendingConfirmation:
    user_id: str
    session_id: str
    tool: str
    arguments: dict[str, Any]
    messages: list[dict[str, Any]]
    tool_call_id: str
    expires_at: float


class ConfirmationStore:
    """Single-use, user-bound confirmation state persisted with a bounded TTL."""

    def __init__(self, db_path: Path, ttl_seconds: int = 15 * 60, max_entries: int = 1_000):
        self.db_path = db_path
        self.ttl_seconds = ttl_seconds
        self.max_entries = max_entries
        self._lock = RLock()
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self.db_path)
        connection.row_factory = sqlite3.Row
        try:
            yield connection
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.execute(
                """CREATE TABLE IF NOT EXISTS agent_tool_confirmations (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    session_id TEXT NOT NULL,
                    tool TEXT NOT NULL,
                    arguments_json TEXT NOT NULL,
                    messages_json TEXT NOT NULL,
                    tool_call_id TEXT NOT NULL,
                    expires_at REAL NOT NULL
                )"""
            )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS ix_agent_tool_confirmations_expiry "
                "ON agent_tool_confirmations(expires_at)"
            )

    def create(
        self,
        confirmation_id: str,
        *,
        user_id: str,
        session_id: str,
        tool: str,
        arguments: dict[str, Any],
        messages: list[dict[str, Any]],
        tool_call_id: str,
    ) -> None:
        with self._lock, self._connect() as connection:
            self._purge_expired(connection)
            total = connection.execute("SELECT COUNT(*) FROM agent_tool_confirmations").fetchone()[0]
            if total >= self.max_entries:
                connection.execute(
                    "DELETE FROM agent_tool_confirmations WHERE id IN "
                    "(SELECT id FROM agent_tool_confirmations ORDER BY expires_at ASC LIMIT 1)"
                )
            connection.execute(
                """INSERT INTO agent_tool_confirmations(
                    id, user_id, session_id, tool, arguments_json, messages_json, tool_call_id, expires_at
                ) VALUES(?,?,?,?,?,?,?,?)""",
                (
                    confirmation_id,
                    user_id,
                    session_id,
                    tool,
                    json.dumps(arguments, ensure_ascii=False),
                    json.dumps(messages, ensure_ascii=False),
                    tool_call_id,
                    time.time() + self.ttl_seconds,
                ),
            )

    def consume(self, confirmation_id: str, user_id: str) -> PendingConfirmation | None:
        with self._lock, self._connect() as connection:
            self._purge_expired(connection)
            row = connection.execute(
                "SELECT * FROM agent_tool_confirmations WHERE id=? AND user_id=?",
                (confirmation_id, user_id),
            ).fetchone()
            if row is None:
                return None
            connection.execute("DELETE FROM agent_tool_confirmations WHERE id=?", (confirmation_id,))
        try:
            arguments = json.loads(row["arguments_json"])
            messages = json.loads(row["messages_json"])
        except (json.JSONDecodeError, TypeError):
            return None
        if not isinstance(arguments, dict) or not isinstance(messages, list):
            return None
        return PendingConfirmation(
            user_id=str(row["user_id"]),
            session_id=str(row["session_id"]),
            tool=str(row["tool"]),
            arguments=arguments,
            messages=[dict(message) for message in messages if isinstance(message, dict)],
            tool_call_id=str(row["tool_call_id"]),
            expires_at=float(row["expires_at"]),
        )

    def discard_session(self, user_id: str, session_id: str) -> None:
        with self._lock, self._connect() as connection:
            self._purge_expired(connection)
            connection.execute(
                "DELETE FROM agent_tool_confirmations WHERE user_id=? AND session_id=?",
                (user_id, session_id),
            )

    @staticmethod
    def _purge_expired(connection: sqlite3.Connection) -> None:
        connection.execute("DELETE FROM agent_tool_confirmations WHERE expires_at <= ?", (time.time(),))
