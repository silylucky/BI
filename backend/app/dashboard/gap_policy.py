"""Dashboard gap policy — 须与 fe/src/components/dashboard/gapPolicy.ts 同步."""

from __future__ import annotations

from typing import Literal

GapPresetName = Literal["none", "sm", "md", "lg", "custom"]

GAP_PRESET_GRID_PX: dict[str, int] = {"none": 0, "sm": 4, "md": 8, "lg": 16}
GAP_PRESET_PIXEL_PX: dict[str, int] = {"none": 0, "sm": 2, "md": 5, "lg": 10}
DEFAULT_CUSTOM_GRID_GAP = 6
DEFAULT_CUSTOM_PIXEL_GAP = 3
PIXEL_GAP_CUSTOM_MAX = 24


def _infer_widget_gap_preset(gap: int) -> GapPresetName:
    if gap <= 0:
        return "none"
    for key, px in GAP_PRESET_GRID_PX.items():
        if key != "none" and px == gap:
            return key  # type: ignore[return-value]
    return "custom"


def _infer_pixel_gap_preset(gutter: int) -> GapPresetName:
    if gutter <= 0:
        return "none"
    for key, px in GAP_PRESET_PIXEL_PX.items():
        if key != "none" and px == gutter:
            return key  # type: ignore[return-value]
    return "custom"


def _preset_fields(preset: GapPresetName) -> tuple[GapPresetName, int, int]:
    if preset == "none":
        return "none", 0, 0
    return preset, GAP_PRESET_GRID_PX[preset], GAP_PRESET_PIXEL_PX[preset]


def normalize_gap_config(
    *,
    gap_preset: GapPresetName | None,
    widget_gap: int | None,
    pixel_gutter: int | None,
) -> tuple[GapPresetName | None, int | None, int | None]:
    """Return (gap_preset, widget_gap, pixel_gutter) canonical triple."""
    if gap_preset == "none":
        return "none", 0, 0

    if gap_preset and gap_preset != "custom" and gap_preset in GAP_PRESET_GRID_PX:
        preset, wg, pg = _preset_fields(gap_preset)
        return preset, wg, pg

    if gap_preset == "custom":
        wg = max(0, widget_gap if widget_gap is not None else DEFAULT_CUSTOM_GRID_GAP)
        pg = min(PIXEL_GAP_CUSTOM_MAX, max(0, pixel_gutter if pixel_gutter is not None else DEFAULT_CUSTOM_PIXEL_GAP))
        return "custom", wg, pg

    wg_val = widget_gap or 0
    pg_val = pixel_gutter or 0
    has_widget = widget_gap is not None and wg_val > 0
    has_pixel = pixel_gutter is not None and pg_val > 0

    if not has_widget and not has_pixel:
        return "none", 0, 0

    if has_widget and not has_pixel:
        # widgetGap 为栅格遗留；像素 shell 默认无间隙
        return "none", wg_val, 0

    if has_pixel and not has_widget:
        inferred = _infer_pixel_gap_preset(pg_val)
        if inferred != "custom":
            preset, wg, pg = _preset_fields(inferred)
            return preset, wg, pg
        return "custom", pg_val, pg_val

    grid_inferred = _infer_widget_gap_preset(wg_val)
    pixel_inferred = _infer_pixel_gap_preset(pg_val)
    if grid_inferred == pixel_inferred and grid_inferred != "custom":
        preset, wg, pg = _preset_fields(grid_inferred)
        return preset, wg, pg

    return "custom", wg_val, min(PIXEL_GAP_CUSTOM_MAX, pg_val)
