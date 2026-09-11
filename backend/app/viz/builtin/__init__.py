from __future__ import annotations

from app.viz.registry import registry

from app.viz.builtin.compare import COMPARE_SPECS
from app.viz.builtin.distribute import DISTRIBUTE_SPECS
from app.viz.builtin.dual_axes import DUAL_AXES_SPECS
from app.viz.builtin.map import MAP_SPECS
from app.viz.builtin.quota import QUOTA_SPECS
from app.viz.builtin.relation import RELATION_SPECS
from app.viz.builtin.table import TABLE_SPECS
from app.viz.builtin.trend import TREND_SPECS

ALL_BUILTIN_SPECS = (
    *QUOTA_SPECS,
    *TABLE_SPECS,
    *TREND_SPECS,
    *COMPARE_SPECS,
    *DISTRIBUTE_SPECS,
    *MAP_SPECS,
    *RELATION_SPECS,
    *DUAL_AXES_SPECS,
)


def register_builtin_chart_types() -> None:
    for spec in ALL_BUILTIN_SPECS:
        registry.upsert(spec)
