from __future__ import annotations

import mimetypes
import sqlite3
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from fastapi import UploadFile

TEXT_EXTENSIONS = {
    ".txt",
    ".md",
    ".csv",
    ".tsv",
    ".json",
    ".log",
    ".sql",
    ".py",
    ".js",
    ".ts",
    ".yaml",
    ".yml",
}
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_TEXT_CONTEXT_CHARS = 20_000


def _utc_now() -> str:
    return datetime.now(UTC).isoformat()


def _safe_filename(value: str) -> str:
    name = Path(value).name.strip()
    return "".join(char if char.isalnum() or char in {"-", "_", "."} else "_" for char in name) or "upload"


class UploadedFileStore:
    """User-isolated uploaded files for Agent conversations and plugins."""

    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self.file_dir = data_dir / "uploads"
        self.db_path = data_dir / "uploads.db"
        self.file_dir.mkdir(parents=True, exist_ok=True)
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
            conn.execute(
                """CREATE TABLE IF NOT EXISTS agent_uploads (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                original_name TEXT NOT NULL,
                stored_path TEXT NOT NULL,
                content_type TEXT,
                size_bytes INTEGER NOT NULL,
                created_at TEXT NOT NULL
                )"""
            )
            conn.execute(
                """CREATE INDEX IF NOT EXISTS idx_agent_uploads_user_created
                ON agent_uploads(user_id, created_at DESC)"""
            )

    async def save(self, user_id: str, file: UploadFile) -> dict[str, Any]:
        if not file.filename:
            raise ValueError("上传文件必须包含文件名")
        file_id = str(uuid.uuid4())
        original_name = _safe_filename(file.filename)
        user_dir = self.file_dir / user_id
        user_dir.mkdir(parents=True, exist_ok=True)
        target = user_dir / f"{file_id}-{original_name}"
        written = 0
        try:
            with target.open("wb") as output:
                while chunk := await file.read(1024 * 1024):
                    written += len(chunk)
                    if written > MAX_UPLOAD_BYTES:
                        raise ValueError("单个附件不能超过 10 MB")
                    output.write(chunk)
        except Exception:
            target.unlink(missing_ok=True)
            raise
        finally:
            await file.close()

        content_type = file.content_type or mimetypes.guess_type(original_name)[0]
        with self.connect() as conn:
            conn.execute(
                """INSERT INTO agent_uploads(
                id,user_id,original_name,stored_path,content_type,size_bytes,created_at
                ) VALUES(?,?,?,?,?,?,?)""",
                (file_id, user_id, original_name, str(target), content_type, written, _utc_now()),
            )
        return self.get(file_id, user_id) or {}

    def list(self, user_id: str, limit: int = 50) -> list[dict[str, Any]]:
        with self.connect() as conn:
            rows = conn.execute(
                """SELECT * FROM agent_uploads WHERE user_id=?
                ORDER BY created_at DESC LIMIT ?""",
                (user_id, max(1, min(limit, 100))),
            ).fetchall()
        return [self._as_dict(row) for row in rows]

    def get(self, file_id: str, user_id: str) -> dict[str, Any] | None:
        with self.connect() as conn:
            row = conn.execute(
                "SELECT * FROM agent_uploads WHERE id=? AND user_id=?", (file_id, user_id)
            ).fetchone()
        return self._as_dict(row) if row else None

    def text_content(self, file_id: str, user_id: str, max_chars: int = MAX_TEXT_CONTEXT_CHARS) -> str:
        metadata = self.get(file_id, user_id)
        if metadata is None:
            raise ValueError("附件不存在或无权访问")
        path = Path(metadata["storedPath"])
        if not path.is_file():
            raise ValueError("附件内容已不可用")
        if path.suffix.lower() not in TEXT_EXTENSIONS:
            raise ValueError("当前仅支持读取文本、CSV、JSON、SQL 和代码类附件")
        try:
            content = path.read_text(encoding="utf-8")
        except UnicodeDecodeError as exc:
            raise ValueError("附件不是 UTF-8 文本，暂不支持解析") from exc
        if len(content) > max_chars:
            return f"{content[:max_chars]}\n\n[文件内容已截断，共 {len(content)} 个字符]"
        return content

    def delete(self, file_id: str, user_id: str) -> bool:
        metadata = self.get(file_id, user_id)
        if metadata is None:
            return False
        with self.connect() as conn:
            conn.execute("DELETE FROM agent_uploads WHERE id=? AND user_id=?", (file_id, user_id))
        Path(metadata["storedPath"]).unlink(missing_ok=True)
        return True

    @staticmethod
    def _as_dict(row: sqlite3.Row) -> dict[str, Any]:
        return {
            "id": row["id"],
            "name": row["original_name"],
            "contentType": row["content_type"],
            "sizeBytes": row["size_bytes"],
            "createdAt": row["created_at"],
            "storedPath": row["stored_path"],
        }
