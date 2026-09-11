import { namedFlavor } from "@protomaps/basemaps";
import type { LayerSpecification } from "maplibre-gl";
import { applyBuildings3dRuntime } from "@/components/charts/engine/maplibre/gisBuildings3d";
import type { GisBasemapFlavor, GisBasemapLayerVisibility } from "@/components/charts/engine/maplibre/gisProject";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** 平台默认海洋色（覆盖 Protomaps 浅青，统一为蓝色）。 */
export const DEFAULT_GIS_WATER_COLOR = "#2563eb";

const WATER_LAYER_PAINT: Record<string, "fill-color" | "line-color"> = {
  water: "fill-color",
  water_stream: "line-color",
  water_river: "line-color",
};

/** Protomaps flavor 中仅 landcover / landuse 使用的陆地细分色键。 */
const LAND_DETAIL_FLAVOR_KEYS = [
  "park_a",
  "park_b",
  "hospital",
  "industrial",
  "school",
  "wood_a",
  "wood_b",
  "pedestrian",
  "scrub_a",
  "scrub_b",
  "glacier",
  "sand",
  "beach",
  "aerodrome",
  "zoo",
  "military",
] as const;

type MapLibreMap = import("maplibre-gl").Map;

export function normalizeBasemapHexColor(input: unknown): string | undefined {
  if (typeof input !== "string") return undefined;
  const trimmed = input.trim();
  if (!HEX_COLOR.test(trimmed)) return undefined;
  return trimmed.toLowerCase();
}

export function resolveBasemapWaterColor(custom?: string): string {
  return normalizeBasemapHexColor(custom) ?? DEFAULT_GIS_WATER_COLOR;
}

export function defaultBasemapPaletteForFlavor(flavorName: GisBasemapFlavor) {
  const flavor = namedFlavor(flavorName);
  return { landColor: flavor.earth, waterColor: DEFAULT_GIS_WATER_COLOR };
}

function harmonizeFlavorLandDetail(
  flavor: ReturnType<typeof namedFlavor>,
  landColor: string,
) {
  for (const key of LAND_DETAIL_FLAVOR_KEYS) {
    flavor[key] = landColor;
  }
  if (flavor.landcover) {
    for (const key of Object.keys(flavor.landcover) as Array<keyof typeof flavor.landcover>) {
      flavor.landcover[key] = landColor;
    }
  }
}

export function buildBasemapFlavor(
  flavorName: GisBasemapFlavor,
  colors?: { landColor?: string; waterColor?: string },
  options?: { harmonizeLandDetail?: boolean },
) {
  const flavor = { ...namedFlavor(flavorName) };
  const landColor = normalizeBasemapHexColor(colors?.landColor);
  if (landColor) {
    flavor.earth = landColor;
    if (options?.harmonizeLandDetail !== false) {
      harmonizeFlavorLandDetail(flavor, landColor);
    }
  }
  flavor.water = resolveBasemapWaterColor(colors?.waterColor);
  return flavor;
}

function isRoadLayer(id: string): boolean {
  return id.startsWith("roads_") || id === "roads_rail";
}

function isLabelLayer(id: string): boolean {
  return (
    id.includes("_label") ||
    id.startsWith("places_") ||
    id === "pois" ||
    id === "address_label" ||
    id === "roads_shields" ||
    id === "roads_oneway"
  );
}

function isBoundaryLayer(id: string): boolean {
  return id.startsWith("boundaries");
}

function isLandDetailLayer(id: string): boolean {
  return id === "landcover" || id.startsWith("landuse_");
}

export function isManagedBasemapLayer(id: string): boolean {
  return (
    isRoadLayer(id) ||
    isLabelLayer(id) ||
    isBoundaryLayer(id) ||
    isLandDetailLayer(id)
  );
}

export function isEarthSurfaceLayer(id: string): boolean {
  return (
    id === "earth" ||
    id === "landcover" ||
    id.startsWith("landuse_") ||
    id === "buildings" ||
    id.startsWith("water")
  );
}

function shouldHideBasemapLayer(id: string, visibility: GisBasemapLayerVisibility): boolean {
  if (visibility.roads === false && isRoadLayer(id)) return true;
  if (visibility.labels === false && isLabelLayer(id)) return true;
  if (visibility.boundaries === false && isBoundaryLayer(id)) return true;
  if (visibility.landDetail === false && isLandDetailLayer(id)) return true;
  return false;
}

export function applyBasemapLayerVisibility(
  layerList: LayerSpecification[],
  visibility: GisBasemapLayerVisibility | undefined,
): LayerSpecification[] {
  if (!visibility) return layerList;
  return layerList.map((layer) => {
    if (!shouldHideBasemapLayer(layer.id, visibility)) return layer;
    return {
      ...layer,
      layout: {
        ...(layer.layout ?? {}),
        visibility: "none",
      },
    };
  });
}

function applyLayerEarthOpacity(
  map: MapLibreMap,
  layerId: string,
  layerType: string,
  opacity: number,
) {
  switch (layerType) {
    case "fill":
      map.setPaintProperty(layerId, "fill-opacity", opacity);
      return;
    case "line":
      map.setPaintProperty(layerId, "line-opacity", opacity);
      return;
    case "fill-extrusion":
      map.setPaintProperty(layerId, "fill-extrusion-opacity", opacity);
      return;
    default:
      return;
  }
}

/** 仅作用于地球表面矢量层；道路/标注/边界保持不透明，避免整图发灰或图层错乱。 */
export function applyEarthBasemapOpacity(map: MapLibreMap, opacity: number) {
  if (!map.isStyleLoaded()) return;
  const clamped = Math.max(0, Math.min(1, opacity));
  for (const layer of map.getStyle().layers ?? []) {
    if (layer.id.startsWith("vs-gis-")) continue;
    if (!isEarthSurfaceLayer(layer.id)) continue;
    applyLayerEarthOpacity(map, layer.id, layer.type, clamped);
  }
}

function applyBasemapLayerVisibilityRuntime(
  map: MapLibreMap,
  visibility: GisBasemapLayerVisibility | undefined,
) {
  if (!visibility) return;
  for (const layer of map.getStyle().layers ?? []) {
    if (layer.id.startsWith("vs-gis-")) continue;
    if (!isManagedBasemapLayer(layer.id)) continue;
    const hidden = shouldHideBasemapLayer(layer.id, visibility);
    map.setLayoutProperty(layer.id, "visibility", hidden ? "none" : "visible");
  }
}

/** 运行时改图层/透明度，避免 setStyle 导致球面视角漂移。颜色以 style 构建为准。 */
export function applyBasemapRuntimePatch(
  map: MapLibreMap,
  patch: {
    basemapLayers?: GisBasemapLayerVisibility;
    buildings3d?: boolean;
    earthOpacity?: number;
  },
) {
  if (!map.isStyleLoaded()) return;

  if (patch.buildings3d !== undefined) {
    applyBuildings3dRuntime(map, patch.buildings3d);
  }

  applyEarthBasemapOpacity(map, patch.earthOpacity ?? 1);
  applyBasemapLayerVisibilityRuntime(map, patch.basemapLayers);
}
