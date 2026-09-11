from __future__ import annotations

import json
import re
import sqlite3
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from app.core.config import Settings

MAX_MEMORY_CONTENT_CHARS = 6_000


def _utc_now() -> str:
    return datetime.now(UTC).isoformat()


def _compact_text(value: str) -> str:
    return " ".join(value.strip().split())[:MAX_MEMORY_CONTENT_CHARS]


def _search_terms(value: str) -> list[str]:
    """Generate FTS-friendly English words and CJK bigrams for recall."""
    terms: list[str] = []
    for segment in re.findall(r"[\u4e00-\u9fff]+|[A-Za-z0-9_]{2,}", value.lower()):
        if re.fullmatch(r"[\u4e00-\u9fff]+", segment):
            if len(segment) == 1:
                terms.append(segment)
            else:
                terms.extend(segment[index : index + 2] for index in range(len(segment) - 1))
        else:
            terms.append(segment)
    return list(dict.fromkeys(term for term in terms if len(term) >= 2))[:32]


class MemoryStore:
    """Per-user persistent long-term memory backed by SQLite FTS5."""

    def __init__(self, db_path: Path, settings: Settings):
        self.db_path = db_path
        self.settings = settings
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.initialize()

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
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

    def initialize(self) -> None:
        with self.connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS agent_memories (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    session_id TEXT,
                    content TEXT NOT NULL,
                    category TEXT NOT NULL DEFAULT 'conversation',
                    importance REAL NOT NULL DEFAULT 0.5 CHECK(importance >= 0 AND importance <= 1),
                    metadata_json TEXT NOT NULL DEFAULT '{}',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    last_accessed_at TEXT,
                    access_count INTEGER NOT NULL DEFAULT 0
                );
                CREATE INDEX IF NOT EXISTS idx_agent_memories_user_created
                    ON agent_memories(user_id, created_at DESC);
                CREATE INDEX IF NOT EXISTS idx_agent_memories_user_category
                    ON agent_memories(user_id, category);
                CREATE VIRTUAL TABLE IF NOT EXISTS agent_memory_fts
                    USING fts5(memory_id UNINDEXED, search_text, tokenize='unicode61');
                """
            )

    def remember(
        self,
        user_id: str,
        content: str,
        *,
        session_id: str | None = None,
        category: str = "conversation",
        importance: float = 0.5,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any] | None:
        normalized = _compact_text(content)
        if not normalized:
            return None
        memory_id = str(uuid.uuid4())
        timestamp = _utc_now()
        safe_importance = max(0.0, min(1.0, float(importance)))
        metadata_json = json.dumps(metadata or {}, ensure_ascii=False, default=str)
        searchable = f"{normalized} {' '.join(_search_terms(normalized))}"
        with self.connect() as conn:
            conn.execute(
                """INSERT INTO agent_memories(
                    id,user_id,session_id,content,category,importance,metadata_json,created_at,updated_at
                ) VALUES(?,?,?,?,?,?,?,?,?)""",
                (
                    memory_id,
                    user_id,
                    session_id,
                    normalized,
                    category,
                    safe_importance,
                    metadata_json,
                    timestamp,
                    timestamp,
                ),
            )
            conn.execute(
                "INSERT INTO agent_memory_fts(memory_id,search_text) VALUES(?,?)",
                (memory_id, searchable),
            )
        return self.get(memory_id, user_id)

    def remember_exchange(
        self,
        user_id: str,
        session_id: str,
        user_input: str,
        answer: str,
    ) -> dict[str, Any] | None:
        if not answer.strip() or answer.startswith("模型调用失败"):
            return None
        return self.remember(
            user_id,
            f"用户：{user_input.strip()}\n助手：{answer.strip()}",
            session_id=session_id,
            category="conversation",
            importance=0.35,
            metadata={"source": "chat"},
        )

    def get(self, memory_id: str, user_id: str | None = None) -> dict[str, Any] | None:
        query = "SELECT * FROM agent_memories WHERE id=?"
        params: tuple[str, ...] = (memory_id,)
        if user_id is not None:
            query += " AND user_id=?"
            params = (memory_id, user_id)
        with self.connect() as conn:
            row = conn.execute(query, params).fetchone()
        return self._memory_dict(row) if row else None

    def list(self, user_id: str, limit: int = 100) -> list[dict[str, Any]]:
        with self.connect() as conn:
            rows = conn.execute(
                """SELECT * FROM agent_memories
                WHERE user_id=? ORDER BY importance DESC, updated_at DESC LIMIT ?""",
                (user_id, self._limit(limit)),
            ).fetchall()
        return [self._memory_dict(row) for row in rows]

    def recall(self, user_id: str, query: str, limit: int | None = None) -> list[dict[str, Any]]:
        terms = _search_terms(query)
        if not terms:
            return []
        fts_query = " OR ".join(f'"{term.replace(chr(34), "")}"' for term in terms)
        max_results = self._limit(limit or self.settings.agent_memory_recall_limit)
        with self.connect() as conn:
            rows = conn.execute(
                """SELECT m.*, bm25(agent_memory_fts) AS relevance
                FROM agent_memory_fts
                JOIN agent_memories m ON m.id = agent_memory_fts.memory_id
                WHERE agent_memory_fts MATCH ? AND m.user_id=?
                ORDER BY (bm25(agent_memory_fts) - m.importance * 2.0 - m.access_count * 0.02) ASC,
                         m.updated_at DESC
                LIMIT ?""",
                (fts_query, user_id, max_results),
            ).fetchall()
            memory_ids = [row["id"] for row in rows]
            if memory_ids:
                placeholders = ",".join("?" for _ in memory_ids)
                conn.execute(
                    f"""UPDATE agent_memories SET access_count=access_count+1,last_accessed_at=?
                    WHERE id IN ({placeholders})""",
                    (_utc_now(), *memory_ids),
                )
        return [self._memory_dict(row) for row in rows]

    def context_for(self, user_id: str, query: str) -> str:
        memories = self.recall(user_id, query)
        if not memories:
            return ""
        lines: list[str] = []
        used = 0
        for item in memories:
            line = f"- [{item['category']}] {item['content']}"
            if used + len(line) > self.settings.agent_memory_context_max_chars:
                break
            lines.append(line)
            used += len(line)
        if not lines:
            return ""
        return (
            "以下是从当前用户长期记忆中检索出的相关历史信息，仅在与当前请求相关时使用；"
            "它可能过时或不完整，不应覆盖用户当前明确指令：\n"
            + "\n".join(lines)
        )

    def delete(self, memory_id: str, user_id: str) -> bool:
        with self.connect() as conn:
            row = conn.execute(
                "SELECT id FROM agent_memories WHERE id=? AND user_id=?",
                (memory_id, user_id),
            ).fetchone()
            if not row:
                return False
            conn.execute("DELETE FROM agent_memory_fts WHERE memory_id=?", (memory_id,))
            conn.execute("DELETE FROM agent_memories WHERE id=?", (memory_id,))
        return True

    def clear_user(self, user_id: str) -> int:
        with self.connect() as conn:
            rows = conn.execute(
                "SELECT id FROM agent_memories WHERE user_id=?", (user_id,)
            ).fetchall()
            memory_ids = [row["id"] for row in rows]
            if memory_ids:
                placeholders = ",".join("?" for _ in memory_ids)
                conn.execute(
                    f"DELETE FROM agent_memory_fts WHERE memory_id IN ({placeholders})",
                    memory_ids,
                )
                conn.execute("DELETE FROM agent_memories WHERE user_id=?", (user_id,))
        return len(memory_ids)

    @staticmethod
    def _limit(value: int) -> int:
        return max(1, min(int(value), 100))

    @staticmethod
    def _memory_dict(row: sqlite3.Row) -> dict[str, Any]:
        item = dict(row)
        try:
            item["metadata"] = json.loads(item.pop("metadata_json"))
        except json.JSONDecodeError:
            item["metadata"] = {}
        return item
