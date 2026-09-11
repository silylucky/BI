from __future__ import annotations

from app.viz.builtin import register_builtin_chart_types
from app.viz.registry import (
    ChartTypeAlreadyRegisteredError,
    ChartTypeNotRegistered,
    ChartTypeRegistry,
    export_chart_type_catalog,
    get_spec,
    registry,
)
from app.viz.specs import ChartTypeSpec, FieldRule

register_builtin_chart_types()

__all__ = [
    "ChartTypeAlreadyRegisteredError",
    "ChartTypeNotRegistered",
    "ChartTypeRegistry",
    "ChartTypeSpec",
    "FieldRule",
    "export_chart_type_catalog",
    "get_spec",
    "register_builtin_chart_types",
    "registry",
]
