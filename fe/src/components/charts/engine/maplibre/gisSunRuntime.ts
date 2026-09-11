import type { GisProjectSun } from "@/components/charts/engine/maplibre/gisProjectSun";
import { resolveGisProjectSun } from "@/components/charts/engine/maplibre/gisProjectSun";
import { GisSunEngine } from "@/components/charts/engine/maplibre/gisSunEngine";
import type { GisSunSettings } from "@/components/charts/engine/maplibre/gisSunPosition";

type MapLibreMap = import("maplibre-gl").Map;

export function toGisSunSettings(
  sun: GisProjectSun | undefined,
  patch?: Partial<GisProjectSun>,
): GisSunSettings {
  const resolved = resolveGisProjectSun({ ...sun, ...patch });
  const { enabled: _enabled, ...settings } = resolved;
  return settings;
}

export function applyGisSunLive(
  engine: GisSunEngine | null,
  sun: GisProjectSun | undefined,
  patch?: Partial<GisProjectSun>,
): GisSunEngine | null {
  const resolved = resolveGisProjectSun(sun);
  if (!resolved.enabled) {
    engine?.destroy();
    return null;
  }
  if (engine) {
    engine.applySettings(toGisSunSettings(sun, patch));
    return engine;
  }
  return null;
}

export function createGisSunEngine(
  map: MapLibreMap,
  sun: GisProjectSun | undefined,
  onTick?: (settings: GisSunSettings) => void,
): GisSunEngine | null {
  const resolved = resolveGisProjectSun(sun);
  if (!resolved.enabled) return null;
  const { enabled: _enabled, ...settings } = resolved;
  return new GisSunEngine(map, settings, onTick);
}
