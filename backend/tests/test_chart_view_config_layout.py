from __future__ import annotations

from app.schemas.chart_view import ChartViewConfigLayout


def test_layout_graph_default_style_variant_normalizes_to_force() -> None:
    cfg = ChartViewConfigLayout.model_validate(
        {"chartType": "graph", "styleVariant": "default"},
    )
    assert cfg.style_variant == "force"
