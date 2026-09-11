"""Dashboard visual PDF export layout modes (G5)."""

from __future__ import annotations

from typing import Literal

ExportLayoutMode = Literal["full_page", "per_widget", "combined"]

EXPORT_LAYOUT_FULL_PAGE: ExportLayoutMode = "full_page"
EXPORT_LAYOUT_PER_WIDGET: ExportLayoutMode = "per_widget"
EXPORT_LAYOUT_COMBINED: ExportLayoutMode = "combined"

EXPORT_LAYOUT_MODES: tuple[ExportLayoutMode, ...] = (
    EXPORT_LAYOUT_FULL_PAGE,
    EXPORT_LAYOUT_PER_WIDGET,
    EXPORT_LAYOUT_COMBINED,
)

MODE_LABELS: dict[ExportLayoutMode, str] = {
    EXPORT_LAYOUT_FULL_PAGE: "整页长图",
    EXPORT_LAYOUT_PER_WIDGET: "按组件分页",
    EXPORT_LAYOUT_COMBINED: "总览与组件放大",
}

ARTIFACT_KINDS: dict[ExportLayoutMode, str] = {
    EXPORT_LAYOUT_FULL_PAGE: "visual_snapshot_full_page",
    EXPORT_LAYOUT_PER_WIDGET: "visual_snapshot_per_widget",
    EXPORT_LAYOUT_COMBINED: "visual_snapshot_combined",
}


def normalize_export_layout_mode(raw: str | None) -> ExportLayoutMode:
    if raw == EXPORT_LAYOUT_PER_WIDGET:
        return EXPORT_LAYOUT_PER_WIDGET
    if raw == EXPORT_LAYOUT_COMBINED:
        return EXPORT_LAYOUT_COMBINED
    return EXPORT_LAYOUT_FULL_PAGE
