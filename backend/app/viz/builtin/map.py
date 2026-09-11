from __future__ import annotations

from app.viz.builtin._helpers import HEATMAP_MATRIX, GIS_MAP_RULE, MAP_RULE, antv

MAP_SPECS = (
    antv("map", "区域地图", "map", library="g2", field_rule=MAP_RULE),
    antv("map-3d", "3D 区域地图", "map", library="d3", field_rule=MAP_RULE),
    antv("gis-map", "GIS 地图", "map", library="maplibre", field_rule=GIS_MAP_RULE),
    antv(
        "heatmap",
        "热力图（已弃用）",
        "map",
        field_rule=HEATMAP_MATRIX,
        deprecated=True,
        migrates_to="t-heatmap",
    ),
)
