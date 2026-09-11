import type { SkySpecification, StyleSpecification } from "maplibre-gl";
import {
  type GisAtmospherePreset,
  type GisProjection,
  type GisProjectFog,
} from "@/components/charts/engine/maplibre/gisProject";

const SKY_BY_PRESET: Record<GisAtmospherePreset, SkySpecification> = {
  day: {
    "sky-color": "#9fd0fb",
    "horizon-color": "#d4ebff",
    "sky-horizon-blend": 0.35,
    "fog-color": "#b8dcfa",
    "horizon-fog-blend": 0.12,
    "fog-ground-blend": 0,
    "atmosphere-blend": 0.72,
  },
  night: {
    "sky-color": "#03040c",
    "horizon-color": "#1e4a9a",
    "sky-horizon-blend": 0.1,
    "fog-color": "#4a7fd4",
    "horizon-fog-blend": 0.14,
    "fog-ground-blend": 0,
    // 关闭 MapLibre 内置 sky 大气，避免盖住 GeoLibre 大气效果插件 canvas 层。
    "atmosphere-blend": 0,
  },
};

/** MapLibre 6 使用 style.sky + map.setSky，不是 Mapbox 的 setFog。 */
export function gisFogToMapLibreSky(
  fog: GisProjectFog | undefined,
  preset?: GisAtmospherePreset,
): SkySpecification {
  if (preset) return { ...SKY_BY_PRESET[preset] };
  const starIntensity = fog?.["star-intensity"] ?? 0;
  if (starIntensity > 0) return { ...SKY_BY_PRESET.night };
  return { ...SKY_BY_PRESET.day };
}

export function mapLibreSkyForPreset(preset: GisAtmospherePreset): SkySpecification {
  return { ...SKY_BY_PRESET[preset] };
}

export function applyGisGlobeToStyle(
  style: StyleSpecification,
  projection: GisProjection | undefined,
  atmospherePreset?: GisAtmospherePreset,
): StyleSpecification {
  if (projection !== "globe") return style;
  return {
    ...style,
    projection: { type: "globe" },
    sky: gisFogToMapLibreSky(undefined, atmospherePreset ?? "day"),
  };
}

export function spaceBackdropForPreset(preset: GisAtmospherePreset | undefined): string | undefined {
  if (preset === "night") {
    return "radial-gradient(ellipse at center, #0c1b33 0%, #081222 100%)";
  }
  if (preset === "day") {
    return "radial-gradient(ellipse at center, #b8dcf8 0%, #8ec5f0 100%)";
  }
  return undefined;
}
