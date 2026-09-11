from __future__ import annotations

import threading

from app.viz.specs import ChartTypeSpec


class ChartTypeNotRegistered(KeyError):
    pass


class ChartTypeAlreadyRegisteredError(ValueError):
    pass


class ChartTypeRegistry:
    def __init__(self) -> None:
        self._specs: dict[str, ChartTypeSpec] = {}
        self._lock = threading.RLock()

    def register(self, spec: ChartTypeSpec) -> None:
        with self._lock:
            if spec.type in self._specs:
                raise ChartTypeAlreadyRegisteredError(
                    f"chart type already registered: {spec.type}"
                )
            self._specs[spec.type] = spec

    def upsert(self, spec: ChartTypeSpec) -> None:
        """注册或热重载时刷新 spec（避免 uvicorn reload 残留旧 field_rule）。"""
        with self._lock:
            self._specs[spec.type] = spec

    def get(self, type: str) -> ChartTypeSpec:
        with self._lock:
            try:
                return self._specs[type]
            except KeyError as exc:
                raise ChartTypeNotRegistered(type) from exc

    def has(self, type: str) -> bool:
        with self._lock:
            return type in self._specs

    def list_specs(self) -> list[ChartTypeSpec]:
        with self._lock:
            return list(self._specs.values())


registry = ChartTypeRegistry()


def get_spec(type: str) -> ChartTypeSpec:
    return registry.get(type)


def export_chart_type_catalog() -> list[dict]:
    from app.viz.builtin import register_builtin_chart_types

    register_builtin_chart_types()
    return [
        {
            "type": s.type,
            "displayName": s.display_name,
            "category": s.category,
            "renderer": s.renderer,
            "styleVariants": list(s.style_variants),
            "capabilities": list(s.capabilities),
            "library": s.library,
            "paletteCategory": s.palette_category or s.category,
            "deprecated": s.deprecated,
            "migratesTo": s.migrates_to,
            "fieldRule": {
                "minDimensions": s.field_rule.min_dimensions,
                "maxDimensions": s.field_rule.max_dimensions,
                "minMetrics": s.field_rule.min_metrics,
                "maxMetrics": s.field_rule.max_metrics,
                "note": s.field_rule.note,
            },
        }
        for s in registry.list_specs()
    ]
