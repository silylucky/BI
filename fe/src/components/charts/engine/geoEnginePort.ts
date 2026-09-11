import type { NumberFormatConfig } from "@/components/dashboard/dashboardStyleConfig";
import {
  analyzeGeoMapMatch,
  buildGeoHeatmapEchartsOption,
  buildGeoHeatmapPlaceholderEchartsOption,
  buildGeoMapEchartsOption,
  buildGeoMapPlaceholderEchartsOption,
  isGeoHeatmapPlaceholderOption,
  isGeoMapPlaceholderOption,
  resolveEmbeddedGeoRoam,
  type GeoChartStyle,
  VS_REGIONS_MAP_ID,
} from "@/components/charts/engine/geo/geoMapChart";
import {
  DEFAULT_GEO_HEATMAP_PLACEHOLDER_HINT,
  DEFAULT_GEO_MAP_PLACEHOLDER_HINT,
  MAP_REGION_NAME_HINT,
} from "@/components/charts/engine/geo/geoConstants";

export type GeoMapBuildInput = {
  rows: unknown[][];
  columns: string[];
  regionField: string;
  metricField: string;
  geo?: GeoChartStyle;
  showLabel?: boolean;
  isDark?: boolean;
  embedEdit?: boolean;
  valueFormat?: NumberFormatConfig;
  mapId?: string;
  knownRegionNames?: string[];
  drillDepth?: number;
  areaMapping?: ReadonlyMap<string, string>;
};

export type GeoHeatmapBuildInput = {
  rows: unknown[][];
  columns: string[];
  xField: string;
  yField: string;
  metricField: string;
  geo?: GeoChartStyle;
  isDark?: boolean;
  valueFormat?: NumberFormatConfig;
};

export type GeoPlaceholderInput = {
  geo?: GeoChartStyle;
  isDark?: boolean;
  roam?: boolean;
};

/** 地图引擎端口：预览/占位/主题面板经此访问，实现可换绑 */
export type GeoEnginePort = {
  readonly mapId: string;
  buildMapOption(input: GeoMapBuildInput): Record<string, unknown>;
  buildMapPlaceholder(input?: GeoPlaceholderInput): Record<string, unknown>;
  buildHeatmapOption(input: GeoHeatmapBuildInput): Record<string, unknown>;
  buildHeatmapPlaceholder(input?: GeoPlaceholderInput): Record<string, unknown>;
  isMapPlaceholder(option: Record<string, unknown>): boolean;
  isHeatmapPlaceholder(option: Record<string, unknown>): boolean;
  analyzeMatch(
    rows: unknown[][],
    columns: string[],
    regionField: string,
    knownRegionNames?: string[],
    drillDepthOrRootLevel?: number | boolean,
    areaMapping?: ReadonlyMap<string, string>,
  ): { total: number; matched: number; unmatched?: string[] };
  resolveEmbeddedRoam(roam: boolean | undefined): boolean;
};

/** @deprecated ECharts option 形态；仅测试与历史占位契约保留 */
export const legacyGeoOptionEngine: GeoEnginePort = {
  mapId: VS_REGIONS_MAP_ID,
  buildMapOption: (input) =>
    buildGeoMapEchartsOption({
      rows: input.rows,
      columns: input.columns,
      regionField: input.regionField,
      metricField: input.metricField,
      geo: input.geo,
      showLabel: input.showLabel,
      isDark: input.isDark,
      embedEdit: input.embedEdit,
      valueFormat: input.valueFormat,
      mapId: input.mapId,
      knownRegionNames: input.knownRegionNames,
    }),
  buildMapPlaceholder: (input) =>
    buildGeoMapPlaceholderEchartsOption({
      geo: input?.geo,
      isDark: input?.isDark,
      roam: input?.roam ?? resolveEmbeddedGeoRoam(input?.geo?.roam),
    }),
  buildHeatmapOption: (input) =>
    buildGeoHeatmapEchartsOption({
      rows: input.rows,
      columns: input.columns,
      xField: input.xField,
      yField: input.yField,
      metricField: input.metricField,
      geo: input.geo,
      isDark: input.isDark,
      valueFormat: input.valueFormat,
    }),
  buildHeatmapPlaceholder: (input) =>
    buildGeoHeatmapPlaceholderEchartsOption({
      geo: input?.geo,
      isDark: input.isDark,
    }),
  isMapPlaceholder: isGeoMapPlaceholderOption,
  isHeatmapPlaceholder: isGeoHeatmapPlaceholderOption,
  analyzeMatch: analyzeGeoMapMatch,
  resolveEmbeddedRoam: resolveEmbeddedGeoRoam,
};

/** @deprecated 使用 legacyGeoOptionEngine */
export const echartsGeoEngine = legacyGeoOptionEngine;

export {
  buildGeoMapEchartsOption,
  buildGeoMapPlaceholderEchartsOption,
  buildGeoHeatmapEchartsOption,
  buildGeoHeatmapPlaceholderEchartsOption,
  DEFAULT_GEO_MAP_PLACEHOLDER_HINT,
  DEFAULT_GEO_HEATMAP_PLACEHOLDER_HINT,
  MAP_REGION_NAME_HINT,
} from "@/components/charts/engine/geo/geoMapChart";

export {
  offlineGeoEngine,
  antvGeoEngine,
} from "@/components/charts/engine/geo/OfflineGeoPort";

/** 当前生产地图引擎（离线 GeoJSON + D3 choropleth） */
export { offlineGeoEngine as activeGeoEngine } from "@/components/charts/engine/geo/OfflineGeoPort";
