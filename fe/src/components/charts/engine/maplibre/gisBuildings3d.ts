import type {
  ExpressionSpecification,
  FillExtrusionLayerSpecification,
  FilterSpecification,
  StyleSpecification,
} from "maplibre-gl";
import type { GisBasemapFlavor } from "@/components/charts/engine/maplibre/gisProject";

export const GIS_BUILDINGS_3D_LAYER_ID = "vs-gis-buildings-3d";
export const FLAT_BUILDINGS_LAYER_ID = "buildings";
/** 与 planet-z15 单栋建筑精度对齐（Protomaps z15 才返回逐栋 OSM 要素）。 */
export const BUILDINGS_3D_MIN_ZOOM = 15;
/** 开启 3D 时平面层保留到 z14，避免低 zoom 建筑消失。 */
export const BUILDINGS_FLAT_MAX_ZOOM_WHEN_3D = 14;
export const BUILDINGS_3D_FALLBACK_HEIGHT_M = 10;
const PMTILES_VECTOR_SOURCE = "protomaps";
const MAPLIBRE_MAX_ZOOM = 24;

type MapLibreMap = import("maplibre-gl").Map;

/**
 * Protomaps 制包时已将 OSM `height` 与 `building:levels`（levels×3+2）写入 `height`。
 * 缺失时回退 10m（Protomaps 社区默认）。`area` 不能用于 fill-extrusion paint，否则会整图 style 失败。
 */
export function resolveBuildings3dHeightExpr(): ExpressionSpecification {
  return ["coalesce", ["get", "height"], BUILDINGS_3D_FALLBACK_HEIGHT_M];
}

/** 排除地址点与 building:part=no（Protomaps #323 / #465）。 */
export function resolveBuildings3dFilter(): FilterSpecification {
  return [
    "all",
    ["match", ["get", "kind"], ["building", "building_part"], true, false],
    ["any", ["!", ["has", "kind_detail"]], ["!=", ["get", "kind_detail"], "no"]],
  ];
}

export function resolveBuildings3dExtrusionPaint(flavor: GisBasemapFlavor) {
  const dark = flavor === "dark" || flavor === "black";
  const heightExpr = resolveBuildings3dHeightExpr();
  return {
    "fill-extrusion-color": dark
      ? (["interpolate", ["linear"], heightExpr, 0, "#94a3b8", 40, "#64748b", 120, "#475569"] as const)
      : (["interpolate", ["linear"], heightExpr, 0, "#f4f4f5", 40, "#d4d4d8", 120, "#a1a1aa"] as const),
    "fill-extrusion-height": heightExpr,
    "fill-extrusion-base": ["coalesce", ["get", "min_height"], 0] as const,
    "fill-extrusion-opacity": 0.92,
    "fill-extrusion-vertical-gradient": true,
  };
}

export function createBuildings3dLayerSpec(
  flavor: GisBasemapFlavor,
  enabled: boolean,
): FillExtrusionLayerSpecification {
  return {
    id: GIS_BUILDINGS_3D_LAYER_ID,
    type: "fill-extrusion",
    source: PMTILES_VECTOR_SOURCE,
    "source-layer": "buildings",
    minzoom: BUILDINGS_3D_MIN_ZOOM,
    layout: { visibility: enabled ? "visible" : "none" },
    filter: resolveBuildings3dFilter(),
    paint: resolveBuildings3dExtrusionPaint(flavor),
  };
}

function patchFlatBuildingsLayerFor3d<T extends StyleSpecification["layers"][number]>(
  layer: T,
  enabled: boolean,
): T {
  if (layer.id !== FLAT_BUILDINGS_LAYER_ID) return layer;
  const next = {
    ...layer,
    layout: {
      ...(layer.layout ?? {}),
      visibility: "visible" as const,
    },
  };
  if (enabled) {
    return { ...next, maxzoom: BUILDINGS_FLAT_MAX_ZOOM_WHEN_3D };
  }
  const { maxzoom: _removed, ...rest } = next as T & { maxzoom?: number };
  return rest as T;
}

export function appendBuildings3dLayerToStyle(
  style: StyleSpecification,
  flavor: GisBasemapFlavor = "light",
  enabled = true,
): StyleSpecification {
  const layers = (style.layers ?? []).map((layer) => patchFlatBuildingsLayerFor3d(layer, enabled));
  return {
    ...style,
    layers: [...layers, createBuildings3dLayerSpec(flavor, enabled)],
  };
}

export function applyBuildings3dRuntime(map: MapLibreMap, enabled: boolean) {
  if (!map.isStyleLoaded()) return;
  if (map.getLayer(GIS_BUILDINGS_3D_LAYER_ID)) {
    map.setLayoutProperty(GIS_BUILDINGS_3D_LAYER_ID, "visibility", enabled ? "visible" : "none");
  }
  if (map.getLayer(FLAT_BUILDINGS_LAYER_ID)) {
    map.setLayoutProperty(FLAT_BUILDINGS_LAYER_ID, "visibility", "visible");
    map.setLayerZoomRange(
      FLAT_BUILDINGS_LAYER_ID,
      0,
      enabled ? BUILDINGS_FLAT_MAX_ZOOM_WHEN_3D : MAPLIBRE_MAX_ZOOM,
    );
  }
}
