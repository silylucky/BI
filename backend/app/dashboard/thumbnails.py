from __future__ import annotations

import uuid
from pathlib import Path

from app.core.config import get_settings

THUMBNAIL_MAX_BYTES = 3 * 1024 * 1024
THUMBNAIL_MIN_BYTES = 256
ALLOWED_CONTENT_TYPES = frozenset({"image/webp", "image/png", "image/jpeg"})
_PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
_JPEG_MAGIC = b"\xff\xd8"


def normalize_thumbnail_content_type(raw: str) -> str:
    return raw.split(";", 1)[0].strip().lower()


def sniff_thumbnail_media(content: bytes, declared: str) -> str:
    if content.startswith(_PNG_MAGIC):
        return "image/png"
    if content.startswith(_JPEG_MAGIC):
        return "image/jpeg"
    if len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "image/webp"
    media = normalize_thumbnail_content_type(declared)
    if media in ALLOWED_CONTENT_TYPES:
        raise ValueError("thumbnail not an image")
    raise ValueError("unsupported thumbnail type")


def validate_thumbnail_payload(content: bytes, content_type: str) -> str:
    if len(content) < THUMBNAIL_MIN_BYTES:
        raise ValueError("thumbnail empty")
    if len(content) > THUMBNAIL_MAX_BYTES:
        raise ValueError("thumbnail too large")
    return sniff_thumbnail_media(content, content_type)


def resolve_data_dir() -> Path:
    """Resolve data dir against repo root, not process cwd (uvicorn often runs in backend/)."""
    configured = Path(get_settings().vitalspan_data_dir)
    if configured.is_absolute():
        return configured
    repo_root = Path(__file__).resolve().parents[3]
    return (repo_root / configured).resolve()


def thumbnail_storage_dir() -> Path:
    path = resolve_data_dir() / "dashboard-thumbnails"
    path.mkdir(parents=True, exist_ok=True)
    return path


def thumbnail_ref_for(dashboard_id: uuid.UUID, ext: str = "webp") -> str:
    return f"dashboard-thumbnails/{dashboard_id}.{ext}"


def viz_component_thumbnail_ref_for(component_id: uuid.UUID, ext: str = "webp") -> str:
    return f"viz-component-thumbnails/{component_id}.{ext}"


def thumbnail_path_for_ref(ref: str) -> Path:
    root = resolve_data_dir()
    path = (root / ref).resolve()
    if root not in path.parents and path != root:
        raise ValueError("invalid thumbnail ref")
    return path


def _write_thumbnail_ref(ref: str, content: bytes) -> str:
    path = thumbnail_path_for_ref(ref)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)
    return ref


def write_thumbnail(dashboard_id: uuid.UUID, content: bytes, content_type: str) -> str:
    media = validate_thumbnail_payload(content, content_type)
    ext = "webp" if media == "image/webp" else "png" if media == "image/png" else "jpg"
    return _write_thumbnail_ref(thumbnail_ref_for(dashboard_id, ext), content)


def write_viz_component_thumbnail(component_id: uuid.UUID, content: bytes, content_type: str) -> str:
    media = validate_thumbnail_payload(content, content_type)
    ext = "webp" if media == "image/webp" else "png" if media == "image/png" else "jpg"
    return _write_thumbnail_ref(viz_component_thumbnail_ref_for(component_id, ext), content)


def read_thumbnail_bytes(ref: str) -> tuple[bytes, str]:
    path = thumbnail_path_for_ref(ref)
    if not path.is_file():
        raise FileNotFoundError(ref)
    ext = path.suffix.lower()
    media = {
        ".webp": "image/webp",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
    }.get(ext, "application/octet-stream")
    return path.read_bytes(), media
