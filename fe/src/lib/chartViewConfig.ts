import { isKnownChartType } from "./chartRegistry";
import { getChartPlugin } from "@/components/charts/engine/plugins/registry";

/** catalog 驱动；保留 string 以兼容 DE 独立 chartType */
export type ChartType = string;

export type ChartTypeL1 = ChartType;

export type ChartFieldRef = {
  field: string;
  label?: string | null;
};

export type ChartFilterRef = {
  field: string;
  operator?: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in";
  value: string | number | boolean | string[];
};

export type ChartTimeRangePreset =
  | "last_7d"
  | "last_30d"
  | "last_90d"
  | "mtd"
  | "ytd";

export type ChartTimeRangeRef = {
  enabled: boolean;
  mode: "relative" | "absolute";
  field?: string;
  relativePreset?: ChartTimeRangePreset;
  start?: string;
  end?: string;
};

export type ChartViewConfig = {
  chartType: ChartType;
  styleVariant?: string;
  dataSourceId?: string;
  bindingId?: string;
  chartId?: string;
  mode?: "sql" | "table" | "native" | "dataset";
  sql?: string;
  schema?: string;
  table?: string;
  datasetId?: string;
  configId?: string;
  /** 绑定 query config 的 revision，用于 execute 缓存失效 */
  configRevision?: number;
  nativeBody?: Record<string, unknown>;
  index?: string;
  dimensions?: ChartFieldRef[];
  metrics?: ChartFieldRef[];
  /** DE 命名轴（权威存储）；dimensions/metrics 为投影兼容 */
  axes?: import("@/lib/chartDeAxis").ChartAxesConfig;
  filters?: ChartFilterRef[];
  timeRange?: ChartTimeRangeRef;
};

import { isCanvasChartType as isCanvasChartTypeFromRegistry } from "@/components/charts/engine/registry";

const KPI_TYPES = new Set<string>(["kpi"]);

export function isKpiType(type: ChartType): boolean {
  return KPI_TYPES.has(type);
}

/** 走外部画布引擎渲染的图表类型（非 legacy table / kpi） */
export function isCanvasChartType(type: ChartType): boolean {
  return isCanvasChartTypeFromRegistry(type);
}

/** @deprecated 使用 isCanvasChartType */
export function isEchartsChartType(type: ChartType): boolean {
  return isCanvasChartType(type);
}

export function isLineOrBarType(type: ChartType): boolean {
  const plugin = getChartPlugin(type);
  if (plugin) {
    return (
      plugin.paletteCategory === "trend" ||
      plugin.paletteCategory === "compare" ||
      plugin.paletteCategory === "dual_axes"
    );
  }
  return type === "line" || type === "bar" || type === "timeline";
}

export function isGeoMapChartType(type: ChartType): boolean {
  return type === "map" || type === "map-3d";
}

export function isGisMapChartType(type: ChartType): boolean {
  return type === "gis-map";
}

export function isMatrixHeatmapChartType(type: ChartType): boolean {
  return type === "heatmap" || type === "t-heatmap";
}

export function isLegacyTableChartType(type: ChartType): boolean {
  return type === "table";
}

export function isCartesianRowLimitedType(type: ChartType): boolean {
  return isLineOrBarType(type);
}

/** 漏斗/桑基/地图等扩展图 */
export function isExtendedEchartsType(type: ChartType): boolean {
  return isCanvasChartType(type) && type !== "line" && type !== "bar" && type !== "pie";
}

export function isChartViewConfig(value: unknown): value is ChartViewConfig {
  if (!value || typeof value !== "object") return false;
  const v = value as ChartViewConfig;
  return typeof v.chartType === "string" && isKnownChartType(v.chartType);
}
