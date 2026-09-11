from __future__ import annotations

from app.schemas.chart_view import ChartViewConfig
from app.viz.registry import get_spec


def build_render_spec(cfg: ChartViewConfig) -> dict:
    spec = get_spec(cfg.chart_type)
    if cfg.binding_id is not None:
        source: dict = {"bindingId": str(cfg.binding_id)}
    else:
        source = {
            "mode": cfg.mode,
            "dataSourceId": str(cfg.data_source_id) if cfg.data_source_id else None,
        }
        if cfg.mode == "sql":
            source["sql"] = cfg.sql
        elif cfg.mode == "table":
            source["schema"] = cfg.schema_name
            source["table"] = cfg.table_name
    return {
        "engine": spec.renderer,
        "chartType": cfg.chart_type,
        "styleVariant": cfg.style_variant,
        "encoding": {
            "dimensions": [{"field": d.field, "label": d.label} for d in cfg.dimensions],
            "metrics": [{"field": m.field, "label": m.label} for m in cfg.metrics],
        },
        "source": source,
    }
