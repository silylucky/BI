"""Build FE export snapshot URLs for Playwright (G5)."""

from __future__ import annotations

from uuid import UUID

from app.core.config import Settings, get_settings
from app.dashboard.export_layout_mode import ExportLayoutMode, normalize_export_layout_mode


def build_export_snapshot_url(
    dashboard_id: UUID,
    *,
    token: str,
    surface: str = "dashboard",
    layout_mode: ExportLayoutMode | str | None = None,
    settings: Settings | None = None,
) -> str:
    settings = settings or get_settings()
    fe_base = settings.fe_base_url.rstrip("/")
    path_prefix = settings.fe_base_path.strip("/")
    if path_prefix:
        fe_base = f"{fe_base}/{path_prefix}"
    path = "data-screen" if surface == "data_screen" else "dashboard"
    mode = normalize_export_layout_mode(layout_mode)
    return f"{fe_base}/export/{path}/{dashboard_id}?token={token}&layoutMode={mode}"
