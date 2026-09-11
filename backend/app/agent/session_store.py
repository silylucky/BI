from __future__ import annotations

import json
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from threading import RLock
from typing import Any


class SessionStore:
    """Durable conversation history, namespaced by VitalSpan user and session."""

    def __init__(self, db_path: Path, max_messages: int):
        self.db_path = db_path
        self.max_messages = max_messages
        self._lock = RLock()
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self.db_path)
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
                """CREATE TABLE IF NOT EXISTS agent_sessions (
                    user_id TEXT NOT NULL,
                    session_id TEXT NOT NULL,
                    history_json TEXT NOT NULL,
                    PRIMARY KEY (user_id, session_id)
                )"""
            )

    def get_history(self, user_id: str, session_id: str) -> list[dict[str, Any]]:
        with self._lock, self._connect() as connection:
            row = connection.execute(
                "SELECT history_json FROM agent_sessions WHERE user_id=? AND session_id=?",
                (user_id, session_id),
            ).fetchone()
        if row is None:
            return []
        try:
            history = json.loads(row[0])
        except (json.JSONDecodeError, TypeError):
            return []
        if not isinstance(history, list):
            return []
        return [
            {"role": str(message["role"]), "content": str(message.get("content", ""))}
            for message in history
            if isinstance(message, dict)
            and message.get("role") in {"user", "assistant"}
            and message.get("content")
        ]

    def set_history(self, user_id: str, session_id: str, messages: list[dict[str, Any]]) -> None:
        compact = [
            {"role": str(message["role"]), "content": str(message.get("content", ""))}
            for message in messages
            if message.get("role") in {"user", "assistant"} and message.get("content")
        ][-self.max_messages :]
        with self._lock, self._connect() as connection:
            connection.execute(
                """INSERT INTO agent_sessions(user_id, session_id, history_json) VALUES(?,?,?)
                ON CONFLICT(user_id, session_id) DO UPDATE SET history_json=excluded.history_json""",
                (user_id, session_id, json.dumps(compact, ensure_ascii=False)),
            )

    def clear(self, user_id: str, session_id: str) -> None:
        with self._lock, self._connect() as connection:
            connection.execute(
                "DELETE FROM agent_sessions WHERE user_id=? AND session_id=?", (user_id, session_id)
            )
