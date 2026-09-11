import chinaProvincesGeo from "@/assets/geo/china-provinces.json";
import type { NumberFormatConfig } from "@/components/dashboard/dashboardStyleConfig";
import {
  analyzeGeoMapMatch,
  listVsRegionNames,
  resolveRegionMetricValue,
} from "@/components/charts/engine/geo/geoMapChart";
import {
  isDecorativeGeoFeature,
  prepareOfflineGeoGeometry,
} from "@/components/charts/engine/geo/geoProjection";
import {
  DEFAULT_GEO_HEATMAP_PLACEHOLDER_HINT,
  DEFAULT_GEO_MAP_PLACEHOLDER_HINT,
  MAP_REGION_NAME_HINT,
  resolveEmbeddedGeoRoam,
  VS_REGIONS_MAP_ID,
} from "@/components/charts/engine/geo/geoConstants";
import type {
  GeoEnginePort,
  GeoHeatmapBuildInput,
  GeoMapBuildInput,
  GeoPlaceholderInput,
} from "@/components/charts/engine/geoEnginePort";
import { formatChartValue } from "@/lib/chartValueFormat";

type RegionsGeo = {
  features?: Array<{
    properties?: {
      name?: string;
      adcode?: number;
      centroid?: number[];
      center?: number[];
    };
    geometry?: GeoJSON.Geometry;
  }>;
};

function readGeoLabelLngLat(properties?: {
  centroid?: number[];
  center?: number[];
}): [number, number] | undefined {
  const raw = properties?.centroid ?? properties?.center;
  if (!Array.isArray(raw) || raw.length < 2) return undefined;
  const lng = Number(raw[0]);
  const lat = Number(raw[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return undefined;
  return [lng, lat];
}

/** HMR 下模块可能双实例；用 globalThis 保证注册表唯一，避免 resolve 写入 A、render 读 B 导致「下钻资产未就绪」 */
type OfflineGeoGlobal = typeof globalThis & {
  __vsOfflineGeoMaps?: Map<string, RegionsGeo>;
};

function getRegisteredMaps(): Map<string, RegionsGeo> {
  const g = globalThis as OfflineGeoGlobal;
  if (!g.__vsOfflineGeoMaps) g.__vsOfflineGeoMaps = new Map();
  return g.__vsOfflineGeoMaps;
}

function normalizeRegionsGeo(geo: RegionsGeo): RegionsGeo {
  return {
    ...geo,
    features: (geo.features ?? []).map((feature) => {
      if (!feature.geometry) return feature;
      return {
        ...feature,
        geometry: prepareOfflineGeoGeometry(feature.geometry),
      };
    }),
  };
}

function ensureDefaultMapRegistered(): void {
  const maps = getRegisteredMaps();
  const current = maps.get(VS_REGIONS_MAP_ID);
  if (current?.features?.length) return;
  maps.set(VS_REGIONS_MAP_ID, normalizeRegionsGeo(chinaProvincesGeo as RegionsGeo));
}

/** 空 / 非法 mapId 回落到全国省级资产，避免 `??` 对 "" 失效 */
export function resolveOfflineGeoMapId(mapId: string | null | undefined): string {
  const trimmed = typeof mapId === "string" ? mapId.trim() : "";
  return trimmed || VS_REGIONS_MAP_ID;
}

export function registerOfflineGeoMap(mapId: string, geo: RegionsGeo): void {
  const id = resolveOfflineGeoMapId(mapId);
  getRegisteredMaps().set(id, normalizeRegionsGeo(geo));
}

export function getOfflineGeoMap(mapId: string): RegionsGeo | undefined {
  ensureDefaultMapRegistered();
  const id = resolveOfflineGeoMapId(mapId);
  if (id === VS_REGIONS_MAP_ID) {
    ensureDefaultMapRegistered();
  }
  return getRegisteredMaps().get(id);
}

function joinMapRows(
  rows: unknown[][],
  columns: string[],
  regionField: string,
  metricField: string,
  mapId: string,
  knownRegionNames?: string[],
  drillDepth = 0,
  areaMapping?: ReadonlyMap<string, string>,
): Array<{
  name: string;
  value: number;
  adcode?: number;
  geometry: GeoJSON.Geometry | null;
  labelLngLat?: [number, number];
}> {
  ensureDefaultMapRegistered();
  const resolvedMapId = resolveOfflineGeoMapId(mapId);
  const ri = columns.indexOf(regionField);
  const mi = columns.indexOf(metricField);
  // 下钻 mapId 禁止回落全国 GeoJSON，否则会画出「全国轮廓」却挂着省级 drillDepth
  let geo = getRegisteredMaps().get(resolvedMapId);
  if (!geo?.features?.length) {
    if (resolvedMapId !== VS_REGIONS_MAP_ID) {
      return [];
    }
    geo = chinaProvincesGeo as RegionsGeo;
  }
  const valueByName = new Map<string, number>();
  if (ri >= 0 && mi >= 0) {
    const knownNames = knownRegionNames ?? listVsRegionNames();
    for (const row of rows) {
      const resolved = resolveRegionMetricValue(
        regionField,
        row[ri],
        knownNames,
        drillDepth,
        areaMapping,
      );
      if (!resolved.name) continue;
      if (drillDepth > 0 && !resolved.matched) continue;
      const raw = Number(row[mi] ?? 0);
      const value = Number.isFinite(raw) ? raw : 0;
      valueByName.set(resolved.name, (valueByName.get(resolved.name) ?? 0) + value);
    }
  }
  return (geo.features ?? [])
    .filter((f) => !isDecorativeGeoFeature(f.properties ?? undefined) && f.geometry != null)
    .map((f) => {
    const name = f.properties?.name ?? "";
    return {
      name,
      value: valueByName.get(name) ?? 0,
      adcode: f.properties?.adcode,
      geometry: (f.geometry as GeoJSON.Geometry | null) ?? null,
      labelLngLat: readGeoLabelLngLat(f.properties),
    };
  });
}

/** D3 choropleth 与离线 geo join 共用 */
export function joinOfflineMapFeatures(
  rows: unknown[][],
  columns: string[],
  regionField: string,
  metricField: string,
  mapId: string,
  knownRegionNames?: string[],
  drillDepth = 0,
  areaMapping?: ReadonlyMap<string, string>,
): Array<{ name: string; value: number; adcode?: number; geometry: GeoJSON.Geometry | null; labelLngLat?: [number, number] }> {
  return joinMapRows(
    rows,
    columns,
    regionField,
    metricField,
    mapId,
    knownRegionNames,
    drillDepth,
    areaMapping,
  );
}

export const offlineGeoEngine: GeoEnginePort = {
  mapId: VS_REGIONS_MAP_ID,
  buildMapOption(input: GeoMapBuildInput) {
    const mapId = input.mapId ?? VS_REGIONS_MAP_ID;
    const features = joinMapRows(
      input.rows,
      input.columns,
      input.regionField,
      input.metricField,
      mapId,
      input.knownRegionNames,
      input.drillDepth ?? 0,
      input.areaMapping,
    );
    return {
      mapId,
      features,
      showLabel: input.showLabel,
      geo: input.geo,
      valueFormat: input.valueFormat,
    };
  },
  buildMapPlaceholder(input?: GeoPlaceholderInput) {
    return {
      __vsGeoMapPlaceholder: true,
      mapId: VS_REGIONS_MAP_ID,
      roam: input?.roam ?? resolveEmbeddedGeoRoam(input?.geo?.roam),
      isDark: input?.isDark,
    };
  },
  buildHeatmapOption(input: GeoHeatmapBuildInput) {
    const xi = input.columns.indexOf(input.xField);
    const yi = input.columns.indexOf(input.yField);
    const mi = input.columns.indexOf(input.metricField);
    const cells = input.rows.map((row) => ({
      x: String(row[xi] ?? ""),
      y: String(row[yi] ?? ""),
      value: Number(row[mi] ?? 0),
    }));
    return { cells, geo: input.geo, valueFormat: input.valueFormat };
  },
  buildHeatmapPlaceholder(input?: GeoPlaceholderInput) {
    return { __vsGeoHeatmapPlaceholder: true, isDark: input?.isDark };
  },
  isMapPlaceholder(option: Record<string, unknown>) {
    return option.__vsGeoMapPlaceholder === true;
  },
  isHeatmapPlaceholder(option: Record<string, unknown>) {
    return option.__vsGeoHeatmapPlaceholder === true;
  },
  analyzeMatch(rows, columns, regionField, knownRegionNames, drillDepthOrRootLevel, areaMapping) {
    return analyzeGeoMapMatch(
      rows,
      columns,
      regionField,
      knownRegionNames,
      drillDepthOrRootLevel,
      areaMapping,
    );
  },
  resolveEmbeddedRoam: resolveEmbeddedGeoRoam,
};

/** @deprecated 使用 offlineGeoEngine */
export const antvGeoEngine = offlineGeoEngine;

export function formatGeoTooltipValue(
  value: number,
  valueFormat?: NumberFormatConfig,
): string {
  return formatChartValue(value, valueFormat);
}

export {
  DEFAULT_GEO_MAP_PLACEHOLDER_HINT,
  DEFAULT_GEO_HEATMAP_PLACEHOLDER_HINT,
  MAP_REGION_NAME_HINT,
  VS_REGIONS_MAP_ID,
};
