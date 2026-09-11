export type PreviewWidgetVisual =
  | "bar"
  | "line"
  | "pie"
  | "table"
  | "kpi"
  | "map"
  | "radar"
  | "gauge"
  | "heatmap"
  | "filter"
  | "text"
  | "media"
  | "tabs"
  | "generic";

const BAR_TYPES = new Set([
  "bar",
  "column",
  "bar-stack",
  "column-stack",
  "bar-horizontal",
  "waterfall",
  "funnel",
]);
const LINE_TYPES = new Set(["line", "area", "area-stack", "line-stack"]);
const PIE_TYPES = new Set(["pie", "donut", "rose", "nightingale"]);
const TABLE_TYPES = new Set(["table", "pivot-table", "detail-table"]);
const KPI_TYPES = new Set(["kpi", "quota", "indicator-card"]);
const MAP_TYPES = new Set(["map", "map-3d", "choropleth", "geo-map"]);
const RADAR_TYPES = new Set(["radar"]);
const GAUGE_TYPES = new Set(["gauge", "liquid", "progress"]);
const HEATMAP_TYPES = new Set(["heatmap", "matrix-heatmap"]);

export function resolvePreviewWidgetVisual(
  widgetType?: string,
  chartType?: string,
): PreviewWidgetVisual {
  if (widgetType === "filter") return "filter";
  if (widgetType === "text") return "text";
  if (widgetType === "media") return "media";
  if (widgetType === "tabs") return "tabs";
  if (chartType) {
    if (BAR_TYPES.has(chartType)) return "bar";
    if (LINE_TYPES.has(chartType)) return "line";
    if (PIE_TYPES.has(chartType)) return "pie";
    if (TABLE_TYPES.has(chartType)) return "table";
    if (KPI_TYPES.has(chartType)) return "kpi";
    if (MAP_TYPES.has(chartType)) return "map";
    if (RADAR_TYPES.has(chartType)) return "radar";
    if (GAUGE_TYPES.has(chartType)) return "gauge";
    if (HEATMAP_TYPES.has(chartType)) return "heatmap";
  }
  return widgetType === "chart" ? "generic" : "generic";
}

/** 稳定伪随机，同 id 缩略图形态一致 */
export function seedFromId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash || 1;
}

export function seededUnit(seed: number, index: number): number {
  const mixed = (seed * 1103515245 + 12345 + index * 97) >>> 0;
  return (mixed % 1000) / 1000;
}
