import type { GeoJSONSource, LayerSpecification, Map as MapLibreMap } from "maplibre-gl";
import { whenGisMapStyleReady } from "@/components/charts/engine/maplibre/gisMapRuntime";

export const GIS_GRATICULE_SOURCE_ID = "vs-gis-graticule";
export const GIS_GRATICULE_LAYER_ID = "vs-gis-graticule-lines";
export const GIS_SUN_NIGHT_LAYER_ID = "vs-gis-sun-night-layer";

const DATA_OVERLAY_PREFIXES = ["vs-gis-layer-", "vs-gis-overlay-"];
const DATA_CORE_LAYER =
  /-circles$|-clusters$|-heat$|-detail$|-cluster-count$|-labels$/;

const GRATICULE_PAINT: import("maplibre-gl").LineLayerSpecification["paint"] = {
  "line-color": "#9eb8e8",
  "line-opacity": 0.88,
  "line-width": [
    "interpolate",
    ["linear"],
    ["zoom"],
    0,
    0.9,
    4,
    1.25,
    8,
    1.6,
  ],
};

const GRATICULE_LAYOUT = {
  "line-join": "round",
  "line-cap": "round",
} as const;

/** 生成经纬网 GeoJSON（默认 15° 间隔，纬度截断至 ±85° 避免极点畸变）。 */
export function buildGraticuleGeoJson(stepDeg = 15): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (let lng = -180; lng <= 180; lng += stepDeg) {
    features.push({
      type: "Feature",
      properties: { kind: "meridian", value: lng },
      geometry: {
        type: "LineString",
        coordinates: [
          [lng, -85],
          [lng, 85],
        ],
      },
    });
  }
  for (let lat = -75; lat <= 75; lat += stepDeg) {
    const coordinates: [number, number][] = [];
    for (let lng = -180; lng <= 180; lng += 2) {
      coordinates.push([lng, lat]);
    }
    features.push({
      type: "Feature",
      properties: { kind: "parallel", value: lat },
      geometry: { type: "LineString", coordinates },
    });
  }
  return { type: "FeatureCollection", features };
}

function graticuleLayerSpec(): import("maplibre-gl").LineLayerSpecification {
  return {
    id: GIS_GRATICULE_LAYER_ID,
    type: "line",
    source: GIS_GRATICULE_SOURCE_ID,
    paint: GRATICULE_PAINT,
    layout: GRATICULE_LAYOUT,
  };
}

function isDataOverlayLayer(id: string): boolean {
  return DATA_OVERLAY_PREFIXES.some((prefix) => id.startsWith(prefix));
}

/** 插在散点光晕/热力光晕之下、实心点/热力核之上，避免被 halo 整块盖住。 */
export function resolveGisGraticuleInsertBeforeId(
  layers: Pick<LayerSpecification, "id">[],
): string | undefined {
  for (const layer of layers) {
    if (!isDataOverlayLayer(layer.id)) continue;
    if (DATA_CORE_LAYER.test(layer.id)) return layer.id;
  }
  for (const layer of layers) {
    if (isDataOverlayLayer(layer.id)) return layer.id;
  }
  return undefined;
}

export function stackGisNightBelowGraticule(map: MapLibreMap): void {
  if (!map.getLayer(GIS_SUN_NIGHT_LAYER_ID) || !map.getLayer(GIS_GRATICULE_LAYER_ID)) return;
  try {
    map.moveLayer(GIS_SUN_NIGHT_LAYER_ID, GIS_GRATICULE_LAYER_ID);
  } catch {
    /* sun engine may re-order on next render */
  }
}

/** 置于昼夜遮罩之上、散点光晕之下（或实心点层之下）。 */
export function placeGisGraticuleLayer(map: MapLibreMap): void {
  if (!map.getLayer(GIS_GRATICULE_LAYER_ID)) return;
  const layers = map.getStyle()?.layers ?? [];
  const beforeId = resolveGisGraticuleInsertBeforeId(layers);
  try {
    if (beforeId) {
      map.moveLayer(GIS_GRATICULE_LAYER_ID, beforeId);
    } else {
      map.moveLayer(GIS_GRATICULE_LAYER_ID);
    }
  } catch {
    /* layer race during style swap */
  }
  stackGisNightBelowGraticule(map);
}

/** style.load / setStyle 会清掉运行时图层；启用时须重建而不只是 moveLayer。 */
export function maintainGisGraticuleStack(map: MapLibreMap, enabled = true): void {
  if (!enabled) return;
  if (!map.isStyleLoaded()) return;
  if (!map.getLayer(GIS_GRATICULE_LAYER_ID)) {
    applyGisGraticuleNow(map, true);
    return;
  }
  placeGisGraticuleLayer(map);
  map.triggerRepaint();
}

function applyGisGraticuleNow(map: MapLibreMap, enabled: boolean) {
  if (!map.isStyleLoaded()) return;

  if (!enabled) {
    if (map.getLayer(GIS_GRATICULE_LAYER_ID)) map.removeLayer(GIS_GRATICULE_LAYER_ID);
    if (map.getSource(GIS_GRATICULE_SOURCE_ID)) map.removeSource(GIS_GRATICULE_SOURCE_ID);
    return;
  }

  const geojson = buildGraticuleGeoJson();
  const existing = map.getSource(GIS_GRATICULE_SOURCE_ID) as GeoJSONSource | undefined;
  if (existing) {
    existing.setData(geojson);
  } else {
    map.addSource(GIS_GRATICULE_SOURCE_ID, { type: "geojson", data: geojson });
  }

  if (!map.getLayer(GIS_GRATICULE_LAYER_ID)) {
    map.addLayer(graticuleLayerSpec());
  }
  placeGisGraticuleLayer(map);
  map.triggerRepaint();
}

/** 样式已就绪时同步应用，供样式栏开关即时生效。 */
export function applyGisGraticuleImmediate(map: MapLibreMap, enabled: boolean) {
  if (map.isStyleLoaded()) {
    applyGisGraticuleNow(map, enabled);
    return;
  }
  whenGisMapStyleReady(map, () => applyGisGraticuleNow(map, enabled));
}

export function applyGisGraticule(map: MapLibreMap, enabled: boolean) {
  applyGisGraticuleImmediate(map, enabled);
}
