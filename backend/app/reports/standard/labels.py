from __future__ import annotations

from app.reports.standard.schemas import ThemeType

THEME_LABELS: dict[ThemeType, str] = {
    "lifecycle": "生命周期",
    "distribution": "区域分布",
    "activity": "活跃度",
    "trend": "趋势",
}
