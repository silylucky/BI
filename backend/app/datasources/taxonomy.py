from __future__ import annotations

from typing import Literal

DisplayGroup = Literal["oltp", "olap", "warehouse", "file", "api", "extension"]

DISPLAY_GROUP_ORDER: tuple[DisplayGroup, ...] = (
    "oltp",
    "olap",
    "warehouse",
    "file",
    "api",
    "extension",
)

DISPLAY_GROUP_LABELS: dict[DisplayGroup, str] = {
    "oltp": "关系型数据库",
    "olap": "OLAP",
    "warehouse": "数仓/湖仓",
    "file": "文件",
    "api": "API",
    "extension": "更多",
}

_CATEGORY_TO_DISPLAY_GROUP: dict[str, DisplayGroup] = {
    "relational": "oltp",
    "olap": "olap",
    "lake": "warehouse",
    "file": "file",
    "api": "api",
    "timeseries": "extension",
    "search": "extension",
    "document": "extension",
    "embedded": "extension",
}


def resolve_display_group(category: str) -> DisplayGroup:
    return _CATEGORY_TO_DISPLAY_GROUP.get(category, "extension")


def label_for_display_group(group: DisplayGroup) -> str:
    return DISPLAY_GROUP_LABELS[group]
