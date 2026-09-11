import type { ChartType } from "@/lib/chartViewConfig";
import {
  beginPaletteDragSession,
  getPaletteDragSessionPayload,
} from "@/lib/paletteDragSession";

export { getPaletteDragSessionPayload };
import {
  isScreenMaterialInsertType,
  type ScreenMaterialInsertType,
} from "@/lib/screenVisualAssets";


export type CustomVizDragPayload = {
  type: "customViz";
  artifactId: string;
  displayName: string;
};

/** HTML5 拖放 MIME；对齐 DataEase/Superset「组件面板 → 画布」 */
export const DASHBOARD_CHART_DND_TYPE = "application/vnd.vitalspan.chart-type";
export const DASHBOARD_FILTER_DND_TYPE = "application/vnd.vitalspan.filter-widget";
export const DASHBOARD_SCREEN_INSERT_DND_TYPE = "application/vnd.vitalspan.screen-insert";
export const DASHBOARD_CUSTOM_VIZ_DND_TYPE = "application/vnd.vitalspan.custom-viz";

/** 新组件默认占位（12 列栅格，约半宽 × 3 行） */
export const DEFAULT_WIDGET_COLSPAN = 6;
export const DEFAULT_WIDGET_ROWSPAN = 3;

export type PaletteDragPayload = ChartType | "filter" | ScreenMaterialInsertType | CustomVizDragPayload;

export function setChartTypeDragData(dataTransfer: DataTransfer, chartType: ChartType): void {
  beginPaletteDragSession(chartType);
  dataTransfer.setData(DASHBOARD_CHART_DND_TYPE, chartType);
  dataTransfer.effectAllowed = "copy";
}

export function setFilterWidgetDragData(dataTransfer: DataTransfer): void {
  beginPaletteDragSession("filter");
  dataTransfer.setData(DASHBOARD_FILTER_DND_TYPE, "filter");
  dataTransfer.effectAllowed = "copy";
}

export function setScreenInsertDragData(
  dataTransfer: DataTransfer,
  insertType: ScreenMaterialInsertType,
): void {
  beginPaletteDragSession(insertType);
  dataTransfer.setData(DASHBOARD_SCREEN_INSERT_DND_TYPE, insertType);
  dataTransfer.effectAllowed = "copy";
}

export function setCustomVizDragData(dataTransfer: DataTransfer, payload: CustomVizDragPayload): void {
  beginPaletteDragSession(payload);
  dataTransfer.setData(DASHBOARD_CUSTOM_VIZ_DND_TYPE, JSON.stringify(payload));
  dataTransfer.effectAllowed = "copy";
}

export function setPaletteDragData(dataTransfer: DataTransfer, payload: PaletteDragPayload): void {
  if (typeof payload === "object" && payload !== null && "type" in payload && payload.type === "customViz") {
    setCustomVizDragData(dataTransfer, payload);
    return;
  }
  if (payload === "filter") {
    setFilterWidgetDragData(dataTransfer);
    return;
  }
  if (isScreenMaterialInsertType(payload)) {
    setScreenInsertDragData(dataTransfer, payload);
    return;
  }
  setChartTypeDragData(dataTransfer, payload);
}

export function readChartTypeFromDragEvent(event: Event): ChartType | null {
  const dt = (event as DragEvent).dataTransfer;
  if (!dt) return null;
  const raw = dt.getData(DASHBOARD_CHART_DND_TYPE);
  return raw ? (raw as ChartType) : null;
}

export function readScreenInsertFromDragEvent(event: Event): ScreenMaterialInsertType | null {
  const dt = (event as DragEvent).dataTransfer;
  if (!dt) return null;
  const raw = dt.getData(DASHBOARD_SCREEN_INSERT_DND_TYPE);
  return raw && isScreenMaterialInsertType(raw) ? raw : null;
}

export function readCustomVizFromDragEvent(event: Event): CustomVizDragPayload | null {
  const dt = (event as DragEvent).dataTransfer;
  if (!dt) return null;
  const raw = dt.getData(DASHBOARD_CUSTOM_VIZ_DND_TYPE);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CustomVizDragPayload;
    if (parsed?.type === "customViz" && parsed.artifactId) return parsed;
  } catch {
    return null;
  }
  return null;
}

export function readPaletteDragPayload(event: Event): PaletteDragPayload | null {
  const dt = (event as DragEvent).dataTransfer;
  if (!dt) return getPaletteDragSessionPayload();
  const customViz = readCustomVizFromDragEvent(event);
  if (customViz) return customViz;
  if (dt.getData(DASHBOARD_FILTER_DND_TYPE) === "filter") return "filter";
  const screenInsert = readScreenInsertFromDragEvent(event);
  if (screenInsert) return screenInsert;
  const chartType = readChartTypeFromDragEvent(event);
  if (chartType) return chartType;
  return getPaletteDragSessionPayload();
}

export function isChartTypeDragEvent(event: React.DragEvent): boolean {
  return event.dataTransfer.types.includes(DASHBOARD_CHART_DND_TYPE);
}

export const FILTER_WIDGET_COLSPAN = 4;
export const FILTER_WIDGET_ROWSPAN = 2;

export function paletteDropSize(payload: PaletteDragPayload): { w: number; h: number } {
  if (payload === "filter") {
    return { w: FILTER_WIDGET_COLSPAN, h: FILTER_WIDGET_ROWSPAN };
  }
  return { w: DEFAULT_WIDGET_COLSPAN, h: DEFAULT_WIDGET_ROWSPAN };
}

export function isPaletteDragEvent(event: React.DragEvent): boolean {
  const types = event.dataTransfer.types;
  return (
    types.includes(DASHBOARD_CHART_DND_TYPE) ||
    types.includes(DASHBOARD_FILTER_DND_TYPE) ||
    types.includes(DASHBOARD_SCREEN_INSERT_DND_TYPE) ||
    types.includes(DASHBOARD_CUSTOM_VIZ_DND_TYPE)
  );
}

export function isNativePaletteDragEvent(event: DragEvent): boolean {
  const types = event.dataTransfer?.types;
  if (!types) return false;
  const list = Array.from(types);
  return (
    list.includes(DASHBOARD_CHART_DND_TYPE) ||
    list.includes(DASHBOARD_FILTER_DND_TYPE) ||
    list.includes(DASHBOARD_SCREEN_INSERT_DND_TYPE) ||
    list.includes(DASHBOARD_CUSTOM_VIZ_DND_TYPE)
  );
}
