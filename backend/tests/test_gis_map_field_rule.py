from __future__ import annotations

from uuid import uuid4

import pytest

from app.schemas.chart_view import ChartViewError, validate_chart_view_config


def _gis_scatter_payload(*, dimensions: list[dict[str, str]], axes: dict | None = None) -> dict:
    payload: dict = {
        "chartType": "gis-map",
        "styleVariant": "default",
        "mode": "dataset",
        "dataSourceId": str(uuid4()),
        "configId": str(uuid4()),
        "dimensions": dimensions,
        "metrics": [],
    }
    if axes is not None:
        payload["axes"] = axes
    return payload


def test_gis_map_scatter_lng_lat_passes_validate() -> None:
    cfg = validate_chart_view_config(
        _gis_scatter_payload(
            dimensions=[
                {"field": "lng"},
                {"field": "lat"},
            ],
        ),
    )
    assert cfg.chart_type == "gis-map"
    assert len(cfg.dimensions) == 2


def test_gis_map_scatter_with_label_passes_validate() -> None:
    cfg = validate_chart_view_config(
        _gis_scatter_payload(
            dimensions=[
                {"field": "lng"},
                {"field": "lat"},
                {"field": "point_name"},
            ],
            axes={
                "xAxis": [{"field": "lng"}],
                "xAxisExt": [{"field": "lat"}],
                "drill": [{"field": "point_name"}],
                "yAxis": [{"field": "amount"}],
            },
        ),
    )
    assert [d.field for d in cfg.dimensions] == ["lng", "lat", "point_name"]
    assert cfg.metrics[0].field == "amount"


def test_gis_map_registry_allows_scatter_slot_count() -> None:
    from app.viz.registry import export_chart_type_catalog, get_spec

    rule = get_spec("gis-map").field_rule
    assert rule.max_dimensions >= 3
    assert rule.max_metrics >= 1
    assert rule.min_metrics == 0

    catalog = export_chart_type_catalog()
    exported = next(item for item in catalog if item["type"] == "gis-map")
    assert exported["fieldRule"]["maxDimensions"] >= 3
