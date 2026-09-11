import type { ResolvedGisEffectsSettings } from "@/components/charts/engine/maplibre/gisGeolibreEffectsSettings";
import { GisGeolibreEffectsEngine } from "@/components/charts/engine/maplibre/gisGeolibreEffectsEngine";

type MapLibreMap = import("maplibre-gl").Map;

export function createGisGeolibreEffectsEngine(
  map: MapLibreMap,
  settings: ResolvedGisEffectsSettings,
): GisGeolibreEffectsEngine {
  return new GisGeolibreEffectsEngine(map, settings);
}

export function applyGisGeolibreEffectsSettings(
  engine: GisGeolibreEffectsEngine | null,
  settings: ResolvedGisEffectsSettings,
): void {
  engine?.applySettings(settings);
}
