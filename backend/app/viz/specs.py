from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class FieldRule:
    min_dimensions: int = 0
    max_dimensions: int = 8
    min_metrics: int = 0
    max_metrics: int = 8
    note: str = ""


@dataclass(frozen=True)
class ChartTypeSpec:
    type: str
    display_name: str
    category: str
    renderer: str
    capabilities: tuple[str, ...] = ()
    style_variants: tuple[str, ...] = ("default",)
    field_rule: FieldRule = field(default_factory=FieldRule)
    library: str = "g2plot"
    palette_category: str = ""
    deprecated: bool = False
    migrates_to: str | None = None
