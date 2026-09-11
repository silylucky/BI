import { layers } from "@protomaps/basemaps";
import type { StyleSpecification } from "maplibre-gl";
import {
  buildGisOverlayLayerDefinitions,
  emptyGisOverlayGeoJson,
  type GisOverlayLayerOptions,
} from "@/components/charts/engine/maplibre/gisMapOverlayStyle";
import {
  applyBasemapLayerVisibility,
  buildBasemapFlavor,
} from "@/components/charts/engine/maplibre/gisBasemapPalette";
import { appendBuildings3dLayerToStyle } from "@/components/charts/engine/maplibre/gisBuildings3d";
import type {
  GisBasemapFlavor,
  GisBasemapLayerVisibility,
  GisLabelLang,
} from "@/components/charts/engine/maplibre/gisProject";
import {
  buildPmtilesVectorSourceUrl,
  colocatedSpriteBaseFromPmtilesUrl,
  resolveGisPmtilesArchiveUrl,
} from "@/components/charts/engine/maplibre/gisPmtilesUrl";
import type { TileServiceResolve } from "@/lib/tileServices";

export const GIS_OVERLAY_SOURCE_ID = "vs-gis-overlay";
export const GIS_OVERLAY_SCATTER_HALO_LAYER_ID = "vs-gis-overlay-scatter-halo";
export const GIS_OVERLAY_GLOW_LAYER_ID = "vs-gis-overlay-glow";
export const GIS_OVERLAY_CIRCLE_LAYER_ID = "vs-gis-overlay-circles";
export const GIS_OVERLAY_LABEL_LAYER_ID = "vs-gis-overlay-labels";
export const GIS_OVERLAY_CLUSTER_LAYER_ID = "vs-gis-overlay-clusters";
export const GIS_OVERLAY_CLUSTER_HALO_LAYER_ID = "vs-gis-overlay-cluster-halo";
export const GIS_OVERLAY_CLUSTER_GLOW_LAYER_ID = "vs-gis-overlay-cluster-glow";
export const GIS_OVERLAY_CLUSTER_COUNT_LAYER_ID = "vs-gis-overlay-cluster-count";
export const GIS_OVERLAY_UNCLUSTERED_FILTER = ["!", ["has", "point_count"]] as const;
export const GIS_OVERLAY_CLUSTER_FILTER = ["has", "point_count"] as const;
export { GIS_BUILDINGS_3D_LAYER_ID } from "@/components/charts/engine/maplibre/gisBuildings3d";
export const PMTILES_SOURCE_ID = "protomaps";

/** 兼容旧登记/默认值中的错误 sprite 路径（v4/light-sprite → sprites/v4/light）。 */
export function normalizeProtomapsSpriteUrl(
  spriteUrl: string | undefined,
  pmtilesUrl?: string,
): string {
  const base = colocatedSpriteBaseFromPmtilesUrl(pmtilesUrl ?? "");
  if (!spriteUrl?.trim()) return `${base}/light`;
  const trimmed = spriteUrl.trim();
  if (trimmed.includes("/v4/light-sprite") || trimmed.endsWith("light-sprite")) {
    return `${base}/light`;
  }
  return trimmed;
}

export function resolveProtomapsSpriteUrl(
  flavor: GisBasemapFlavor,
  spriteUrl: string | undefined,
  pmtilesUrl?: string,
): string {
  const base = colocatedSpriteBaseFromPmtilesUrl(pmtilesUrl ?? spriteUrl ?? "");
  const trimmed = spriteUrl?.trim();
  if (trimmed) {
    const normalized = normalizeProtomapsSpriteUrl(trimmed, pmtilesUrl);
    const flavorSuffix = normalized.match(/\/sprites\/v4\/(light|dark|grayscale|white|black)$/);
    if (flavorSuffix) {
      return normalized.replace(/\/(light|dark|grayscale|white|black)$/, `/${flavor}`);
    }
    if (normalized.includes("/v4/light-sprite") || normalized.endsWith("light-sprite")) {
      return `${base}/${flavor}`;
    }
    return normalized;
  }
  return `${base}/${flavor}`;
}

export type BuildPmtilesStyleOptions = {
  flavor?: GisBasemapFlavor;
  buildings3d?: boolean;
  landColor?: string;
  waterColor?: string;
  basemapLayers?: GisBasemapLayerVisibility;
};

export function buildPmtilesStyle(
  resolved: TileServiceResolve,
  labelLang: GisLabelLang = "zh-Hans",
  options: BuildPmtilesStyleOptions = {},
): StyleSpecification {
  const flavorName = options.flavor ?? "light";
  const harmonizeLandDetail = options.basemapLayers?.landDetail !== false;
  const flavor = buildBasemapFlavor(flavorName, {
    landColor: options.landColor,
    waterColor: options.waterColor,
  }, { harmonizeLandDetail });
  const sprite = resolveGisPmtilesArchiveUrl(
    resolveProtomapsSpriteUrl(flavorName, resolved.spriteUrl, resolved.pmtilesUrl),
  );
  const baseLayers = applyBasemapLayerVisibility(
    layers(PMTILES_SOURCE_ID, flavor, { lang: labelLang }),
    options.basemapLayers,
  );
  const style: StyleSpecification = {
    version: 8,
    glyphs: resolveGisPmtilesArchiveUrl(resolved.glyphsUrl),
    sprite,
    sources: {
      [PMTILES_SOURCE_ID]: {
        type: "vector",
        url: buildPmtilesVectorSourceUrl(resolved.pmtilesUrl),
        attribution: resolved.name,
      },
    },
    layers: baseLayers,
  };
  return appendBuildings3dLayerToStyle(style, flavorName, options.buildings3d !== false);
}

/** @deprecated 使用 appendBuildings3dLayerToStyle */
export function appendBuildings3dLayer(
  style: StyleSpecification,
  flavor: GisBasemapFlavor = "light",
): StyleSpecification {
  return appendBuildings3dLayerToStyle(style, flavor, true);
}

export type { GisOverlayLayerOptions };

export function appendGisOverlayLayers(
  style: StyleSpecification,
  overlay: GeoJSON.FeatureCollection | null,
  options: GisOverlayLayerOptions,
): StyleSpecification {
  const data = overlay ?? emptyGisOverlayGeoJson();
  const { source, layers } = buildGisOverlayLayerDefinitions(data, options);
  return {
    ...style,
    sources: {
      ...style.sources,
      [source.id]: source.spec,
    },
    layers: [...(style.layers ?? []), ...layers],
  };
}

/** @deprecated 保留测试引用；请使用 appendGisOverlayLayers + GisOverlayLayerOptions */
export function appendGisOverlayLayersLegacy(
  style: StyleSpecification,
  overlay: GeoJSON.FeatureCollection,
  flavor: GisBasemapFlavor = "light",
): StyleSpecification {
  return appendGisOverlayLayers(style, overlay, { flavor });
}
