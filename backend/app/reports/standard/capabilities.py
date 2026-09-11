from __future__ import annotations

from app.reports.standard.schemas import FieldMapping, ThemeCapability, ThemeType

_THEME_REQUIREMENTS: dict[ThemeType, tuple[str, ...]] = {
    "lifecycle": ("status",),
    "distribution": ("region",),
    "activity": ("created_at",),
    "trend": ("created_at",),
}


def _column_names(columns: list[dict]) -> set[str]:
    return {str(c.get("name", "")).lower() for c in columns}


def _mapping_has_field(mapping: FieldMapping, field: str) -> bool:
    val = getattr(mapping, field, None)
    return bool(val)


def evaluate_capabilities(
    mapping: FieldMapping,
    columns: list[dict],
    enabled_themes: list[ThemeType] | None = None,
) -> list[ThemeCapability]:
    col_set = _column_names(columns)
    themes: list[ThemeCapability] = []
    for theme, required in _THEME_REQUIREMENTS.items():
        missing = [f for f in required if not _mapping_has_field(mapping, f)]
        if missing:
            themes.append(
                ThemeCapability(
                    theme=theme,
                    available=False,
                    reason=f"缺少字段映射: {', '.join(missing)}",
                )
            )
            continue
        mapped_cols = [getattr(mapping, f) for f in required if getattr(mapping, f)]
        if not all(str(c).lower() in col_set for c in mapped_cols):
            themes.append(
                ThemeCapability(
                    theme=theme,
                    available=False,
                    reason="映射列不在数据集列中",
                )
            )
            continue
        if enabled_themes is not None and theme not in enabled_themes:
            themes.append(
                ThemeCapability(
                    theme=theme,
                    available=False,
                    reason="未启用该主题",
                )
            )
            continue
        themes.append(ThemeCapability(theme=theme, available=True))
    return themes
