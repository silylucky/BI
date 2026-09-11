"""Artifact storage port: filesystem (default) or in-memory (tests)."""

from __future__ import annotations

import os
import uuid
from pathlib import Path

from app.core.config import Settings, get_settings


class ArtifactStorePort:
    def put(self, key: str, data: bytes, content_type: str) -> str:
        raise NotImplementedError

    def get(self, key: str) -> bytes | None:
        raise NotImplementedError

    def delete(self, key: str) -> None:
        raise NotImplementedError


class FsArtifactStore(ArtifactStorePort):
    def __init__(self, root: Path) -> None:
        self._root = root
        self._root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        safe = key.replace("..", "").lstrip("/")
        return self._root / safe

    def put(self, key: str, data: bytes, content_type: str) -> str:
        del content_type
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return key

    def get(self, key: str) -> bytes | None:
        path = self._path(key)
        if not path.is_file():
            return None
        return path.read_bytes()

    def delete(self, key: str) -> None:
        path = self._path(key)
        if path.is_file():
            path.unlink(missing_ok=True)


class MemoryArtifactStore(ArtifactStorePort):
    def __init__(self) -> None:
        self._data: dict[str, bytes] = {}

    def put(self, key: str, data: bytes, content_type: str) -> str:
        del content_type
        self._data[key] = data
        return key

    def get(self, key: str) -> bytes | None:
        return self._data.get(key)

    def delete(self, key: str) -> None:
        self._data.pop(key, None)

    def clear(self) -> None:
        self._data.clear()


_memory_store = MemoryArtifactStore()


def artifact_storage_key(prefix: str, entity_id: uuid.UUID, ext: str) -> str:
    return f"{prefix}/{entity_id}/{uuid.uuid4().hex}.{ext}"


def get_artifact_store(settings: Settings | None = None) -> ArtifactStorePort:
    settings = settings or get_settings()
    backend = settings.artifact_storage_backend
    if backend == "memory":
        return _memory_store
    root = Path(settings.artifact_storage_path)
    return FsArtifactStore(root)


def reset_artifact_store_for_tests() -> None:
    _memory_store.clear()
