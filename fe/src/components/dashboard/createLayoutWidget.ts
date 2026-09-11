import type { ChartType } from "@/lib/chartViewConfig";
import { getChartTypeDisplayName } from "@/lib/chartRegistry";
import { isWidgetConfigReady } from "@/lib/chartConfigState";
import { randomId } from "@/lib/randomId";
import {
  DEFAULT_WIDGET_COLSPAN,
  DEFAULT_WIDGET_ROWSPAN,
} from "@/lib/dashboardDnd";
import {
  createScreenBorderWidget,
  createScreenClockWidget,
  createScreenDateTimeWidget,
  createScreenIconWidget,
  createScreenShapeWidget,
  createScreenTitleBarWidget,
  createScreenWebpageWidget,
  type ScreenMaterialInsertType,
} from "@/lib/screenVisualAssets";
import {
  defaultChartConfig,
  defaultFilterConfig,
  defaultMediaConfig,
  defaultTabsConfig,
  defaultTextConfig,
  FILTER_CONTROL_META,
  type FilterControlType,
  type LayoutWidget,
} from "./layoutUtils";
import type { VizComponentListItem } from "@/lib/vizComponents";

export type FilterInsertPayload = {
  type: "filter";
  controlType: FilterControlType;
};

export type ScreenPresetInsertPayload = {
  insert: "screen-border" | "screen-shape" | "screen-icon";
  preset: string;
};

export type CustomVizInsertPayload = {
  type: "customViz";
  artifactId: string;
  displayName?: string;
};

export type PaletteInsertType =
  | ChartType
  | "filter"
  | FilterInsertPayload
  | "text"
  | "media"
  | "tabs"
  | CustomVizInsertPayload
  | ScreenMaterialInsertType
  | ScreenPresetInsertPayload;

const FILTER_WIDGET_TITLES: Record<FilterControlType, string> = {
  text: "文本筛选",
  select: "下拉筛选",
  date: "日期筛选",
  multiselect: "多选筛选",
};

function resolveFilterControlType(type: PaletteInsertType): FilterControlType | null {
  if (type === "filter") return "text";
  if (typeof type === "object" && "type" in type && type.type === "filter") return type.controlType;
  return null;
}

function isCustomVizInsert(type: PaletteInsertType): type is CustomVizInsertPayload {
  return typeof type === "object" && "type" in type && type.type === "customViz";
}

function isScreenPresetInsert(
  type: PaletteInsertType,
): type is ScreenPresetInsertPayload {
  return typeof type === "object" && "insert" in type && "preset" in type;
}

export function createLayoutWidget(
  type: ChartType,
  widgets: LayoutWidget[],
  at?: { gridX: number; gridY: number; colSpan?: number; rowSpan?: number },
): LayoutWidget {
  const widgetId = randomId();
  const maxOrder = widgets.reduce((m, w) => Math.max(m, w.order), -1);
  return {
    id: widgetId,
    type: "chart",
    title: getChartTypeDisplayName(type),
    colSpan: at?.colSpan ?? DEFAULT_WIDGET_COLSPAN,
    rowSpan: at?.rowSpan ?? DEFAULT_WIDGET_ROWSPAN,
    order: maxOrder + 1,
    gridX: at?.gridX,
    gridY: at?.gridY,
    chartConfig: { ...defaultChartConfig(type), chartId: widgetId },
  };
}

export function createFilterWidget(
  widgets: LayoutWidget[],
  at?: { gridX: number; gridY: number; colSpan?: number; rowSpan?: number },
  controlType: FilterControlType = "text",
): LayoutWidget {
  const widgetId = randomId();
  const maxOrder = widgets.reduce((m, w) => Math.max(m, w.order), -1);
  const baseConfig = defaultFilterConfig(widgetId);
  return {
    id: widgetId,
    type: "filter",
    title: FILTER_WIDGET_TITLES[controlType] ?? FILTER_CONTROL_META[controlType].label,
    colSpan: at?.colSpan ?? 4,
    rowSpan: at?.rowSpan ?? 2,
    order: maxOrder + 1,
    gridX: at?.gridX,
    gridY: at?.gridY,
    filterConfig: {
      ...baseConfig,
      controlType,
      options: controlType === "select" || controlType === "multiselect" ? baseConfig.options : [],
    },
  };
}

export function createTextWidget(
  widgets: LayoutWidget[],
  at?: { gridX: number; gridY: number; colSpan?: number; rowSpan?: number },
): LayoutWidget {
  const widgetId = randomId();
  const maxOrder = widgets.reduce((m, w) => Math.max(m, w.order), -1);
  return {
    id: widgetId,
    type: "text",
    title: "富文本",
    colSpan: at?.colSpan ?? 6,
    rowSpan: at?.rowSpan ?? 2,
    order: maxOrder + 1,
    gridX: at?.gridX,
    gridY: at?.gridY,
    textConfig: defaultTextConfig(),
  };
}

export function createMediaWidget(
  widgets: LayoutWidget[],
  at?: { gridX: number; gridY: number; colSpan?: number; rowSpan?: number },
): LayoutWidget {
  const widgetId = randomId();
  const maxOrder = widgets.reduce((m, w) => Math.max(m, w.order), -1);
  return {
    id: widgetId,
    type: "media",
    title: "媒体",
    colSpan: at?.colSpan ?? 6,
    rowSpan: at?.rowSpan ?? 3,
    order: maxOrder + 1,
    gridX: at?.gridX,
    gridY: at?.gridY,
    mediaConfig: defaultMediaConfig(),
  };
}

export function createTabsWidget(
  widgets: LayoutWidget[],
  at?: { gridX: number; gridY: number; colSpan?: number; rowSpan?: number },
): LayoutWidget {
  const widgetId = randomId();
  const maxOrder = widgets.reduce((m, w) => Math.max(m, w.order), -1);
  return {
    id: widgetId,
    type: "tabs",
    title: "页签",
    colSpan: at?.colSpan ?? 12,
    rowSpan: at?.rowSpan ?? 4,
    order: maxOrder + 1,
    gridX: at?.gridX,
    gridY: at?.gridY,
    tabsConfig: defaultTabsConfig(widgetId),
  };
}

export function createCustomVizWidget(
  artifactId: string,
  displayName: string,
  widgets: LayoutWidget[],
  at?: { gridX: number; gridY: number; colSpan?: number; rowSpan?: number },
): LayoutWidget {
  const widgetId = randomId();
  const maxOrder = widgets.reduce((m, w) => Math.max(m, w.order), -1);
  return {
    id: widgetId,
    type: "customViz",
    title: displayName || "自定义组件",
    colSpan: at?.colSpan ?? DEFAULT_WIDGET_COLSPAN,
    rowSpan: at?.rowSpan ?? DEFAULT_WIDGET_ROWSPAN,
    order: maxOrder + 1,
    gridX: at?.gridX,
    gridY: at?.gridY,
    customVizConfig: {
      artifactId,
      dataBinding: { status: "manual" },
    },
  };
}

export function createPaletteWidget(
  type: PaletteInsertType,
  widgets: LayoutWidget[],
  at?: { gridX: number; gridY: number; colSpan?: number; rowSpan?: number },
): LayoutWidget {
  const filterControlType = resolveFilterControlType(type);
  if (filterControlType != null) return createFilterWidget(widgets, at, filterControlType);
  if (isCustomVizInsert(type)) {
    return createCustomVizWidget(
      type.artifactId,
      type.displayName ?? "自定义组件",
      widgets,
      at,
    );
  }
  if (isScreenPresetInsert(type)) {
    if (type.insert === "screen-border") {
      return createScreenBorderWidget(widgets, at, type.preset);
    }
    if (type.insert === "screen-shape") {
      return createScreenShapeWidget(widgets, at, type.preset);
    }
    return createScreenIconWidget(widgets, at, type.preset);
  }
  if (type === "text") return createTextWidget(widgets, at);
  if (type === "media") return createMediaWidget(widgets, at);
  if (type === "tabs") return createTabsWidget(widgets, at);
  if (type === "screen-clock") return createScreenClockWidget(widgets, at);
  if (type === "screen-border") return createScreenBorderWidget(widgets, at);
  if (type === "screen-title-bar") return createScreenTitleBarWidget(widgets, at);
  if (type === "screen-datetime") return createScreenDateTimeWidget(widgets, at);
  if (type === "screen-webpage") return createScreenWebpageWidget(widgets, at);
  return createLayoutWidget(type as ChartType, widgets, at);
}

export function createLinkedLayoutWidget(
  component: Pick<VizComponentListItem, "id" | "name" | "widgetType">,
  widgets: LayoutWidget[],
  at?: { gridX: number; gridY: number; colSpan?: number; rowSpan?: number },
): LayoutWidget {
  const widgetId = randomId();
  const maxOrder = widgets.reduce((m, w) => Math.max(m, w.order), -1);
  return {
    id: widgetId,
    type: component.widgetType,
    title: component.name,
    colSpan: at?.colSpan ?? DEFAULT_WIDGET_COLSPAN,
    rowSpan: at?.rowSpan ?? DEFAULT_WIDGET_ROWSPAN,
    order: maxOrder + 1,
    gridX: at?.gridX,
    gridY: at?.gridY,
    componentRef: { componentId: component.id },
  } as LayoutWidget;
}

export { isWidgetConfigReady } from "@/lib/chartConfigState";
