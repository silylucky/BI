"""Built-in dashboard template asset static files (fe/public or fe/dist)."""

from __future__ import annotations

import logging
from pathlib import Path

from app.core.config import Settings

logger = logging.getLogger(__name__)


def resolve_repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def resolve_template_assets_dir() -> Path | None:
    """Prefer fe/public (source of truth); fe/dist may be stale after partial builds."""
    root = resolve_repo_root()
    for rel in ("fe/public/template-assets", "fe/dist/template-assets"):
        candidate = root / rel
        if candidate.is_dir():
            return candidate
    return None


def template_assets_mount_path(settings: Settings) -> str:
    segment = settings.fe_base_path.strip("/")
    return f"/{segment}/template-assets" if segment else "/template-assets"


def is_template_assets_path(path: str, settings: Settings) -> bool:
    prefix = template_assets_mount_path(settings)
    return path == prefix or path.startswith(f"{prefix}/")
