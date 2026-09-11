import type { ChartViewConfig, ChartType, ChartFieldRef, ChartFilterRef } from "@/lib/chartViewConfig";
import { randomId } from "@/lib/randomId";
import { migrateChartViewConfig } from "@/lib/migrateChartTypes";
import { resolveChartWidgetTitle } from "@/lib/chartTypeDisplayNames";
import { chartInspectorCapabilities } from "@/lib/chartInspectorCapabilities";
import { DEFAULT_CHART_LEGEND_STYLE, buildDefaultChartTitleLabelStyle, readChartDeStyle, type ChartDeStyle } from "@/lib/chartDeStyle";
import { DEFAULT_TABLE_COLUMN_WIDTH_MODE } from "@/lib/chartDeTableStyle";
import { isTableLikeChartType } from "@/lib/chartTableInspector";
import { DEFAULT_MAP_3D_CHART_DE_STYLE } from "@/lib/defaultMap3dChartDeStyle";
import { buildDefaultChartDeDisplay } from "@/lib/chartDeDisplay";
import { defaultGisProjectNativeBody } from "@/components/charts/engine/maplibre/gisProject";
import { buildDefaultPieDeStyle, isPieChartType } from "@/lib/defaultPieChartDeStyle";
import { buildDefaultRadarDeStyle } from "@/lib/defaultRadarChartDeStyle";
import { buildDefaultTreemapDeStyle } from "@/lib/defaultTreemapChartDeStyle";
import type { ScreenVisualStyleConfig } from "@/lib/screenVisualStyle";
import type { DashboardLayoutV2, LayoutWidget, PixelLayoutWidget } from "./dashboardLayoutContracts";
import type { WidgetStyleConfig } from "./dashboardStyleConfig";

export type {
  DashboardCanvas,
  DashboardLayout,
  DashboardLayoutV1,
  DashboardLayoutV2,
  DashboardWidgetBase,
  LayoutWidget,
  PixelLayoutWidget,
} from "./dashboardLayoutContracts";

export type FilterControlType = "text" | "select" | "date" | "multiselect";

export const FILTER_CONTROL_META: Record<FilterControlType, { label: string }> = {
  text: { label: "文本" },
  select: { label: "下拉" },
  date: { label: "日期" },
  multiselect: { label: "多选" },
};

export const FILTER_CONTROL_TYPES = Object.keys(FILTER_CONTROL_META) as FilterControlType[];

export type FilterOption = {
  label: string;
  value: string;
};

export type FilterWidgetConfig = {
  filterId: string;
  dimensionRef: string;
  controlType: FilterControlType;
  defaultValue?: string | null;
  options?: FilterOption[];
  parameterKey?: string;
};

export type TextVariant = "markdown" | "plain" | "html";

export type TextWidgetConfig = {
  content: string;
  variant: TextVariant;
  datasetId?: string;
  dimensionField?: string;
  metricField?: string;
  /** 大屏素材组件样式（时钟/边框/标题装饰/日期时间/图形/图标） */
  screenStyle?: ScreenVisualStyleConfig;
  /** 单组件外框样式（覆盖看板默认 widgetStyle） */
  widgetStyle?: WidgetStyleConfig;
};

export type MediaWidgetKind = "image" | "webpage";

export type MediaFit = "contain" | "cover" | "fill";

export type MediaAlign = "center" | "top" | "bottom" | "left" | "right";

export type MediaWidgetConfig = {
  kind?: MediaWidgetKind;
  url: string;
  alt: string;
  fit: MediaFit;
  /** 图片在容器内的锚点（object-position） */
  align?: MediaAlign;
  /** 0–1，默认 1 */
  opacity?: number;
  borderRadius?: number;
  /** 留白区域底色（contain 时可见） */
  background?: string;
  linkUrl?: string;
  linkNewTab?: boolean;
  /** 单组件外框样式（覆盖看板默认 widgetStyle） */
  widgetStyle?: WidgetStyleConfig;
};

export type CustomVizMetricRef = ChartFieldRef & {
  agg?: "sum" | "avg" | "max" | "min" | "count";
};

export type CustomVizDataBinding = {
  status?: "manual" | "connected";
  dataSourceId?: string;
  datasetId?: string;
  configId?: string;
  dimensions?: ChartFieldRef[];
  metrics?: CustomVizMetricRef[];
  filters?: ChartFilterRef[];
  refreshMode?: string;
  resultLimit?: string;
};

/** L3 平台通用样式（对标内置 chart 样式 Tab 六块） */
export type CustomVizDisplayStyle = Pick<
  ChartDeStyle,
  | "paletteId"
  | "paletteColors"
  | "paletteOpacity"
  | "seriesGradient"
  | "title"
  | "remark"
  | "label"
  | "tooltip"
  | "background"
  | "border"
>;

export type CustomVizWidgetConfig = {
  artifactId: string;
  dataBinding?: CustomVizDataBinding;
  /** manifest styleSchema 扩展项（组件专属） */
  style?: Record<string, unknown>;
  /** 平台通用六块：背景/配色/标题/备注/标签/提示 */
  displayStyle?: CustomVizDisplayStyle;
  widgetStyle?: WidgetStyleConfig;
};

export function mediaAlignToObjectPosition(align: MediaAlign = "center"): string {
  const map: Record<MediaAlign, string> = {
    center: "center center",
    top: "center top",
    bottom: "center bottom",
    left: "left center",
    right: "right center",
  };
  return map[align];
}

export function defaultMediaConfig(): MediaWidgetConfig {
  return {
    kind: "image",
    url: "",
    alt: "",
    fit: "contain",
    align: "center",
    opacity: 1,
    borderRadius: 0,
    background: "",
    linkUrl: "",
    linkNewTab: true,
  };
}

export function normalizeMediaConfig(raw?: Partial<MediaWidgetConfig>): MediaWidgetConfig {
  const defaults = defaultMediaConfig();
  if (!raw) return defaults;
  return {
    ...defaults,
    ...raw,
    kind: raw.kind ?? defaults.kind,
    url: raw.url ?? defaults.url,
    alt: raw.alt ?? defaults.alt,
    fit: raw.fit ?? defaults.fit,
    align: raw.align ?? defaults.align,
    opacity: raw.opacity ?? defaults.opacity,
    borderRadius: raw.borderRadius ?? defaults.borderRadius,
    background: raw.background ?? defaults.background,
    linkUrl: raw.linkUrl ?? defaults.linkUrl,
    linkNewTab: raw.linkNewTab ?? defaults.linkNewTab,
  };
}

export type TabPaneConfig = {
  id: string;
  title: string;
  childWidgetIds: string[];
};

export type TabsHeadStyleConfig = {
  fontSize?: number;
  activeColor?: string;
  inactiveColor?: string;
  barBackground?: string;
};

export type TabsCarouselConfig = {
  enabled: boolean;
  intervalSec: number;
};

export type TabsWidgetConfig = {
  tabsId: string;
  panes: TabPaneConfig[];
  activePaneId: string;
  /** 预览/投放态自动轮播（编辑态不生效） */
  carousel?: TabsCarouselConfig;
  /** 单组件外框样式（覆盖看板默认 widgetStyle） */
  widgetStyle?: WidgetStyleConfig;
  /** 页签栏外观 */
  headStyle?: TabsHeadStyleConfig;
};

export const TABS_CAROUSEL_MIN_INTERVAL_SEC = 3;

export type {
  DashboardStyleConfig,
  GapPreset,
  ScaleMode,
  WidgetStyleConfig,
  TitleStyleConfig,
  FilterChromeStyleConfig,
  FilterControlStyleConfig,
  NumberFormatConfig,
} from "./dashboardStyleConfig";
export {
  GAP_PRESET_PX,
  resolveWidgetGap,
  resolvePixelGutter,
  resolveQueryLimit,
  styleConfigHasPersistedFields,
  CANVAS_BG_SWATCHES,
} from "./dashboardStyleConfig";

export type WidgetType = "chart" | "filter" | "text" | "media" | "tabs" | "customViz";

export function defaultTextConfig(): TextWidgetConfig {
  return { content: "", variant: "html" };
}

export function defaultTabsConfig(tabsId: string): TabsWidgetConfig {
  const paneA = randomId();
  const paneB = randomId();
  const paneC = randomId();
  return {
    tabsId,
    panes: [
      { id: paneA, title: "页签 1", childWidgetIds: [] },
      { id: paneB, title: "页签 2", childWidgetIds: [] },
      { id: paneC, title: "页签 3", childWidgetIds: [] },
    ],
    activePaneId: paneA,
    headStyle: { fontSize: 14 },
  };
}

export function defaultFilterConfig(filterId: string): FilterWidgetConfig {
  return {
    filterId,
    dimensionRef: "region",
    controlType: "text",
    defaultValue: "",
    options: [],
    parameterKey: "region",
  };
}

/** 旧 layout 缺 type / 非法 type → chart；按 type 补齐 config */
export function coerceLayoutWidget(raw: Partial<LayoutWidget> & { id: string }): LayoutWidget {
  const type: WidgetType =
    raw.type === "filter" ||
    raw.type === "text" ||
    raw.type === "media" ||
    raw.type === "tabs" ||
    raw.type === "customViz"
      ? raw.type
      : "chart";
  const defaultTitle =
    type === "filter"
      ? "筛选器"
      : type === "text"
        ? "富文本"
        : type === "media"
          ? "媒体"
          : type === "tabs"
            ? "页签"
            : type === "customViz"
              ? "自定义组件"
              : "图表";
  const base = {
    id: raw.id,
    title: raw.title?.trim() || defaultTitle,
    colSpan: raw.colSpan ?? 6,
    rowSpan: raw.rowSpan ?? (type === "text" ? 2 : type === "media" ? 3 : 1),
    order: raw.order ?? 0,
    gridX: raw.gridX,
    gridY: raw.gridY,
    parentTabsId: raw.parentTabsId,
    tabPaneId: raw.tabPaneId,
  };
  if (type === "filter") {
    return {
      ...base,
      type: "filter",
      filterConfig: raw.filterConfig ?? defaultFilterConfig(raw.id),
    };
  }
  if (type === "text") {
    return {
      ...base,
      type: "text",
      textConfig: raw.textConfig ?? defaultTextConfig(),
    };
  }
  if (type === "media") {
    return {
      ...base,
      type: "media",
      mediaConfig: normalizeMediaConfig(raw.mediaConfig),
    };
  }
  if (type === "tabs") {
    return {
      ...base,
      type: "tabs",
      tabsConfig: raw.tabsConfig ?? defaultTabsConfig(raw.id),
    };
  }
  if (type === "customViz") {
    return {
      ...base,
      type: "customViz",
      customVizConfig: raw.customVizConfig ?? { artifactId: "", dataBinding: { status: "manual" } },
    };
  }
  return normalizeChartWidgetTitle({
    ...base,
    type: "chart",
    chartConfig: migrateChartViewConfig(raw.chartConfig ?? defaultChartConfig("bar")),
  });
}

function normalizeChartWidgetTitle(widget: LayoutWidget): LayoutWidget {
  if (widget.type !== "chart") return widget;
  const chartType = widget.chartConfig?.chartType;
  const nextTitle = resolveChartWidgetTitle(widget.title, chartType);
  if (nextTitle === widget.title) return widget;
  return { ...widget, title: nextTitle };
}

export function getTopLevelWidgets(widgets: LayoutWidget[]): LayoutWidget[] {
  return sortWidgets(widgets.filter((w) => !w.parentTabsId));
}

/** 像素画布仅渲染顶层 shape；Tab 内子组件在 TabsWidget 内嵌展示 */
export function getTopLevelPixelWidgets(widgets: PixelLayoutWidget[]): PixelLayoutWidget[] {
  return sortWidgets(widgets.filter((w) => !w.parentTabsId)) as PixelLayoutWidget[];
}

export function pointInPixelWidget(
  point: { x: number; y: number },
  widget: Pick<PixelLayoutWidget, "x" | "y" | "width" | "height">,
): boolean {
  return (
    point.x >= widget.x &&
    point.x <= widget.x + widget.width &&
    point.y >= widget.y &&
    point.y <= widget.y + widget.height
  );
}

/** 落点落在组件外扩缓冲区内（对标碰撞轻触区，用于 Tab 投放命中） */
export function pointInPixelWidgetWithBuffer(
  point: { x: number; y: number },
  widget: Pick<PixelLayoutWidget, "x" | "y" | "width" | "height">,
  bufferPx: number,
): boolean {
  const buffer = Math.max(0, bufferPx);
  if (buffer <= 0) return pointInPixelWidget(point, widget);
  return (
    point.x >= widget.x - buffer &&
    point.x <= widget.x + widget.width + buffer &&
    point.y >= widget.y - buffer &&
    point.y <= widget.y + widget.height + buffer
  );
}

/** 拖放落点处的 Tab 容器（多重重叠时取面积最小者，视为最上层） */
export function findTabsHostAtPoint(
  widgets: PixelLayoutWidget[],
  point: { x: number; y: number },
  dropBufferPx = 0,
): PixelLayoutWidget | undefined {
  const hosts = getTopLevelPixelWidgets(widgets).filter(
    (w) =>
      w.type === "tabs" &&
      w.tabsConfig &&
      w.width > 0 &&
      w.height > 0 &&
      pointInPixelWidgetWithBuffer(point, w, dropBufferPx),
  );
  if (hosts.length === 0) return undefined;
  return hosts.reduce((best, w) =>
    w.width * w.height < best.width * best.height ? w : best,
  );
}

/** 插入子组件时解析目标 Tab 宿主：DOM/落点（含缓冲）优先，否则已选中 Tab */
export function resolvePixelTabsHost(
  layout: DashboardLayoutV2,
  selectedWidgetId: string | null | undefined,
  point?: { x: number; y: number },
  tabsWidgetIdFromDom?: string | null,
  dropBufferPx = 0,
): PixelLayoutWidget | undefined {
  if (tabsWidgetIdFromDom) {
    const fromDom = layout.widgets.find((w) => w.id === tabsWidgetIdFromDom);
    if (fromDom?.type === "tabs" && fromDom.tabsConfig) return fromDom;
  }
  if (point) {
    const atPoint = findTabsHostAtPoint(layout.widgets, point, dropBufferPx);
    if (atPoint) return atPoint;
  }
  if (selectedWidgetId) {
    const selected = layout.widgets.find((w) => w.id === selectedWidgetId);
    if (selected?.type === "tabs" && selected.tabsConfig) return selected;
  }
  return undefined;
}

/** Tab 内嵌子组件在布局适配层的默认栅格占位（与栅格模式 appendWidget 一致） */
export const TAB_CHILD_DEFAULT_COL_SPAN = 12;
export const TAB_CHILD_DEFAULT_ROW_SPAN = 2;

/** Tab 子组件不参与画布占位与碰撞，坐标折叠到容器内 */
export function parkPixelWidgetInTab(
  child: PixelLayoutWidget,
  host: PixelLayoutWidget,
  tabPaneId: string,
): PixelLayoutWidget {
  return {
    ...child,
    parentTabsId: host.id,
    tabPaneId,
    x: host.x,
    y: host.y,
    width: 0,
    height: 0,
  };
}

/** Tab 宿主移动后，同步折叠子组件画布坐标 */
export function syncParkedTabChildren(widgets: PixelLayoutWidget[]): PixelLayoutWidget[] {
  const byId = new Map(widgets.map((w) => [w.id, w]));
  return widgets.map((w) => {
    if (!w.parentTabsId || !w.tabPaneId) return w;
    const host = byId.get(w.parentTabsId);
    if (!host || host.type !== "tabs") return w;
    return parkPixelWidgetInTab(w, host, w.tabPaneId);
  });
}

/**
 * 页签 panes.childWidgetIds 已登记但 widget 仍带顶层坐标的组件 → park。
 * 避免「页签内 + 画布顶层」双渲染叠放。
 */
export function repairUnparkedTabChildren(widgets: PixelLayoutWidget[]): PixelLayoutWidget[] {
  let changed = false;
  const next = widgets.map((widget) => {
    if (widget.type === "tabs" || widget.parentTabsId) return widget;
    for (const host of widgets) {
      if (host.type !== "tabs" || !host.tabsConfig || host.id === widget.id) continue;
      for (const pane of host.tabsConfig.panes) {
        if (!pane.childWidgetIds.includes(widget.id)) continue;
        changed = true;
        return parkPixelWidgetInTab(widget, host, pane.id);
      }
    }
    return widget;
  });
  return changed ? syncParkedTabChildren(next) : widgets;
}

/** 将已写入 layout 的组件归入 Tab 页签（折叠占位 + 更新 childWidgetIds） */
export function insertPixelWidgetIntoTab(
  layout: DashboardLayoutV2,
  draft: PixelLayoutWidget,
  host: PixelLayoutWidget,
  tabPaneId: string,
): DashboardLayoutV2 {
  if (host.type !== "tabs" || !host.tabsConfig || draft.type === "tabs") {
    return layout;
  }
  const parked = parkPixelWidgetInTab(draft, host, tabPaneId);
  const widgets = layout.widgets.map((w) => {
    if (w.id === draft.id) return parked;
    if (w.id !== host.id || w.type !== "tabs" || !w.tabsConfig) return w;
    const panes = w.tabsConfig.panes.map((pane) =>
      pane.id === tabPaneId && !pane.childWidgetIds.includes(draft.id)
        ? { ...pane, childWidgetIds: [...pane.childWidgetIds, draft.id] }
        : pane,
    );
    return { ...w, tabsConfig: { ...w.tabsConfig, panes } };
  });
  return { ...layout, widgets: syncParkedTabChildren(widgets) };
}

function removeWidgetIdFromTabPanes(
  widgets: PixelLayoutWidget[],
  widgetId: string,
): PixelLayoutWidget[] {
  return widgets.map((w) => {
    if (w.type !== "tabs" || !w.tabsConfig) return w;
    const panes = w.tabsConfig.panes.map((pane) => ({
      ...pane,
      childWidgetIds: pane.childWidgetIds.filter((id) => id !== widgetId),
    }));
    return { ...w, tabsConfig: { ...w.tabsConfig, panes } };
  });
}

/** 将画布顶层已有组件拖入 Tab 页签（先从旧页签摘除，再 park） */
export function movePixelWidgetIntoTab(
  layout: DashboardLayoutV2,
  widgetId: string,
  host: PixelLayoutWidget,
  tabPaneId: string,
): DashboardLayoutV2 {
  const widget = layout.widgets.find((w) => w.id === widgetId);
  if (!widget || widget.type === "tabs" || widget.id === host.id) return layout;
  if (host.type !== "tabs" || !host.tabsConfig) return layout;

  const cleaned: DashboardLayoutV2 = {
    ...layout,
    widgets: removeWidgetIdFromTabPanes(layout.widgets, widgetId),
  };
  const draft = cleaned.widgets.find((w) => w.id === widgetId);
  if (!draft) return layout;
  return insertPixelWidgetIntoTab(cleaned, draft, host, tabPaneId);
}

function sortTabChildrenByPaneOrder(children: LayoutWidget[], paneChildIds: string[]): LayoutWidget[] {
  return [...children].sort((a, b) => {
    const ai = paneChildIds.indexOf(a.id);
    const bi = paneChildIds.indexOf(b.id);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return (a.order ?? 0) - (b.order ?? 0);
  });
}

/** 以 widget.parentTabsId + tabPaneId 为真理源；childWidgetIds 仅作排序与无归属字段的旧数据兜底 */
export function getTabChildWidgets(widgets: LayoutWidget[], tabsWidgetId: string, paneId: string): LayoutWidget[] {
  const tabs = widgets.find((w) => w.id === tabsWidgetId && w.type === "tabs" && w.tabsConfig);
  if (!tabs?.tabsConfig) return [];
  const pane = tabs.tabsConfig.panes.find((p) => p.id === paneId);
  if (!pane) return [];

  const usesRelation = widgets.some((w) => w.parentTabsId === tabsWidgetId);
  if (usesRelation) {
    const byRelation = widgets.filter(
      (w) => w.parentTabsId === tabsWidgetId && w.tabPaneId === paneId,
    );
    return sortTabChildrenByPaneOrder(byRelation, pane.childWidgetIds);
  }

  const idSet = new Set(pane.childWidgetIds);
  return sortTabChildrenByPaneOrder(
    widgets.filter((w) => idSet.has(w.id)),
    pane.childWidgetIds,
  );
}

export function isTabPaneChild(
  widgets: LayoutWidget[],
  tabsWidgetId: string,
  childId: string | null | undefined,
): boolean {
  if (!childId) return false;
  const child = widgets.find((w) => w.id === childId);
  if (!child) return false;
  if (child.parentTabsId === tabsWidgetId && child.tabPaneId) return true;
  const tabs = widgets.find((w) => w.id === tabsWidgetId && w.type === "tabs" && w.tabsConfig);
  return Boolean(
    tabs?.tabsConfig?.panes.some((pane) => pane.childWidgetIds.includes(childId)),
  );
}

/** 将 tabsConfig.panes[].childWidgetIds 与 widget 归属字段对齐（加载/保存前调用） */
export function reconcileTabPaneChildIds(widgets: LayoutWidget[]): LayoutWidget[] {
  const byPane = new Map<string, LayoutWidget[]>();
  for (const w of widgets) {
    if (!w.parentTabsId || !w.tabPaneId) continue;
    const key = `${w.parentTabsId}:${w.tabPaneId}`;
    const list = byPane.get(key) ?? [];
    list.push(w);
    byPane.set(key, list);
  }

  return widgets.map((w) => {
    if (w.type !== "tabs" || !w.tabsConfig) return w;
    const hostUsesRelation = widgets.some((child) => child.parentTabsId === w.id);
    const panes = w.tabsConfig.panes.map((pane) => {
      const related = byPane.get(`${w.id}:${pane.id}`);
      if (related?.length) {
        const childWidgetIds = sortTabChildrenByPaneOrder(related, pane.childWidgetIds).map(
          (child) => child.id,
        );
        return { ...pane, childWidgetIds };
      }
      if (hostUsesRelation) {
        return { ...pane, childWidgetIds: [] };
      }
      return pane;
    });
    return { ...w, tabsConfig: { ...w.tabsConfig, panes } };
  });
}

/** 像素布局载入/变更时同步 Tab 的 childWidgetIds */
export function reconcileTabPaneChildIdsInPixelLayout(layout: DashboardLayoutV2): DashboardLayoutV2 {
  const reconciled = reconcileTabPaneChildIds(layout.widgets);
  const cfgById = new Map(
    reconciled
      .filter((w) => w.type === "tabs" && w.tabsConfig)
      .map((w) => [w.id, w.tabsConfig!]),
  );
  if (cfgById.size === 0) return layout;
  let changed = false;
  const widgets = layout.widgets.map((w) => {
    const nextCfg = cfgById.get(w.id);
    if (!nextCfg || w.type !== "tabs") return w;
    const same =
      JSON.stringify(w.tabsConfig?.panes.map((p) => p.childWidgetIds)) ===
      JSON.stringify(nextCfg.panes.map((p) => p.childWidgetIds));
    if (same) return w;
    changed = true;
    return { ...w, tabsConfig: nextCfg };
  });
  return changed ? { ...layout, widgets } : layout;
}

export function appendWidgetToTabPane(
  widgets: LayoutWidget[],
  tabsWidgetId: string,
  paneId: string,
  childId: string,
): LayoutWidget[] {
  return widgets.map((w) => {
    if (w.id !== tabsWidgetId || w.type !== "tabs" || !w.tabsConfig) return w;
    const panes = w.tabsConfig.panes.map((pane) =>
      pane.id === paneId ? { ...pane, childWidgetIds: [...pane.childWidgetIds, childId] } : pane,
    );
    return { ...w, tabsConfig: { ...w.tabsConfig, panes } };
  });
}

export function coerceLayoutWidgets(widgets: Array<Partial<LayoutWidget> & { id: string }>): LayoutWidget[] {
  return normalizeLayerOrders(reconcileTabPaneChildIds(widgets.map(coerceLayoutWidget)));
}

export function sortWidgets(widgets: LayoutWidget[]): LayoutWidget[] {
  return [...widgets].sort(compareWidgetLayerOrder);
}

/** 同组内叠放顺序：order 升序，相同 order 以 id 稳定排序 */
export function compareWidgetLayerOrder(
  a: Pick<LayoutWidget, "order" | "id">,
  b: Pick<LayoutWidget, "order" | "id">,
): number {
  const delta = a.order - b.order;
  return delta !== 0 ? delta : a.id.localeCompare(b.id);
}

/**
 * 将同级组件 order 压实为 0..n-1，消除重复/空洞，保证 z-index 与图层面板严格一致。
 */
export function normalizeLayerOrders(widgets: LayoutWidget[]): LayoutWidget[] {
  const groups = new Map<string, LayoutWidget[]>();
  for (const widget of widgets) {
    const key = getLayerSiblingKey(widget);
    const list = groups.get(key) ?? [];
    list.push(widget);
    groups.set(key, list);
  }

  const orderById = new Map<string, number>();
  let dirty = false;
  for (const siblings of groups.values()) {
    const sorted = [...siblings].sort(compareWidgetLayerOrder);
    sorted.forEach((widget, index) => {
      orderById.set(widget.id, index);
      if (widget.order !== index) dirty = true;
    });
  }

  if (!dirty) return widgets;

  return widgets.map((widget) => {
    const nextOrder = orderById.get(widget.id);
    if (nextOrder === undefined || nextOrder === widget.order) return widget;
    return { ...widget, order: nextOrder };
  });
}

/** 图层同级分组键：画布顶层 vs 同一 Tab 页签内 */
export function getLayerSiblingKey(widget: LayoutWidget): string {
  if (widget.parentTabsId) {
    return `tab:${widget.parentTabsId}:${widget.tabPaneId ?? ""}`;
  }
  return "canvas";
}

/** 与目标组件同级的兄弟列表（已按 order 升序） */
export function getLayerSiblings(widgets: LayoutWidget[], id: string): LayoutWidget[] {
  const target = widgets.find((w) => w.id === id);
  if (!target) return [];
  const key = getLayerSiblingKey(target);
  return sortWidgets(widgets.filter((w) => getLayerSiblingKey(w) === key));
}

export function moveWidget(widgets: LayoutWidget[], id: string, direction: "up" | "down"): LayoutWidget[] {
  const siblings = getLayerSiblings(widgets, id);
  const sorted = [...siblings].sort(compareWidgetLayerOrder);
  const currentIdx = sorted.findIndex((w) => w.id === id);
  if (currentIdx < 0) return widgets;
  const swapIdx = direction === "up" ? currentIdx - 1 : currentIdx + 1;
  if (swapIdx < 0 || swapIdx >= sorted.length) return widgets;
  const reordered = [...sorted];
  [reordered[currentIdx], reordered[swapIdx]] = [reordered[swapIdx]!, reordered[currentIdx]!];
  const orderById = new Map(reordered.map((widget, index) => [widget.id, index]));
  return normalizeLayerOrders(
    widgets.map((widget) =>
      orderById.has(widget.id) ? { ...widget, order: orderById.get(widget.id)! } : widget,
    ),
  );
}

export function moveWidgetToExtreme(
  widgets: LayoutWidget[],
  id: string,
  position: "top" | "bottom",
): LayoutWidget[] {
  const siblings = getLayerSiblings(widgets, id);
  const sorted = [...siblings].sort(compareWidgetLayerOrder);
  const currentIdx = sorted.findIndex((w) => w.id === id);
  if (currentIdx < 0) return widgets;
  const targetIdx = position === "top" ? sorted.length - 1 : 0;
  if (currentIdx === targetIdx) return widgets;
  const reordered = [...sorted];
  const [item] = reordered.splice(currentIdx, 1);
  reordered.splice(targetIdx, 0, item!);
  const orderById = new Map(reordered.map((widget, index) => [widget.id, index]));
  return normalizeLayerOrders(
    widgets.map((widget) =>
      orderById.has(widget.id) ? { ...widget, order: orderById.get(widget.id)! } : widget,
    ),
  );
}

export function resizeWidget(
  widgets: LayoutWidget[],
  id: string,
  patch: Partial<Pick<LayoutWidget, "colSpan" | "rowSpan" | "title">>,
): LayoutWidget[] {
  return widgets.map((w) => (w.id === id ? { ...w, ...patch } : w));
}

export function normalizeWidgetIds(widgets: LayoutWidget[]): LayoutWidget[] {
  return widgets.map((w) => {
    if (w.type !== "chart" || !w.chartConfig) return w;
    return {
    ...w,
    chartConfig: { ...w.chartConfig, chartId: w.id },
    };
  });
}

export function isChartWidget(widget: LayoutWidget): widget is LayoutWidget & { chartConfig: ChartViewConfig } {
  return widget.type === "chart" && Boolean(widget.chartConfig);
}

export function isFilterWidget(
  widget: LayoutWidget,
): widget is LayoutWidget & { type: "filter"; filterConfig: FilterWidgetConfig } {
  return widget.type === "filter" && Boolean(widget.filterConfig);
}

export function defaultChartConfig(type: ChartType): ChartViewConfig {
  const base = {
    dataSourceId: "",
    mode: "dataset" as const,
  };
  const withLegendDefault = (cfg: ChartViewConfig): ChartViewConfig => {
    if (!chartInspectorCapabilities(type).legend) return cfg;
    return {
      ...cfg,
      nativeBody: {
        ...cfg.nativeBody,
        deStyle: {
          ...readChartDeStyle(cfg),
          legend: { ...DEFAULT_CHART_LEGEND_STYLE },
        },
      },
    };
  };
  const withTableColumnWidthDefault = (cfg: ChartViewConfig): ChartViewConfig => {
    if (!isTableLikeChartType(type)) return cfg;
    return {
      ...cfg,
      nativeBody: {
        ...cfg.nativeBody,
        deTableStyle: {
          columnWidthMode: DEFAULT_TABLE_COLUMN_WIDTH_MODE,
          ...cfg.nativeBody?.deTableStyle,
        },
      },
    };
  };
  const withPieDefaultDeStyle = (cfg: ChartViewConfig): ChartViewConfig => {
    if (!isPieChartType(type)) return cfg;
    const pieDefaults = buildDefaultPieDeStyle(type);
    const prev = readChartDeStyle(cfg);
    return {
      ...cfg,
      nativeBody: {
        ...cfg.nativeBody,
        deStyle: {
          ...prev,
          pie: { ...pieDefaults.pie },
          label: { ...pieDefaults.label },
        },
      },
    };
  };
  const withRadarDefaultDeStyle = (cfg: ChartViewConfig): ChartViewConfig => {
    if (type !== "radar") return cfg;
    const radarDefaults = buildDefaultRadarDeStyle();
    const prev = readChartDeStyle(cfg);
    return {
      ...cfg,
      nativeBody: {
        ...cfg.nativeBody,
        deStyle: {
          ...prev,
          radar: { ...radarDefaults.radar },
          label: { ...radarDefaults.label },
        },
      },
    };
  };
  const withTreemapDefaultDeStyle = (cfg: ChartViewConfig): ChartViewConfig => {
    if (type !== "treemap") return cfg;
    const treemapDefaults = buildDefaultTreemapDeStyle();
    const prev = readChartDeStyle(cfg);
    return {
      ...cfg,
      nativeBody: {
        ...cfg.nativeBody,
        deStyle: {
          ...prev,
          treemap: { ...treemapDefaults.treemap },
          label: { ...treemapDefaults.label },
        },
      },
    };
  };
  const withDefaultTitleAndLabel = (cfg: ChartViewConfig): ChartViewConfig => {
    const prev = readChartDeStyle(cfg);
    const seed = buildDefaultChartTitleLabelStyle();
    return {
      ...cfg,
      nativeBody: {
        ...cfg.nativeBody,
        deStyle: {
          ...prev,
          title: { ...seed.title, ...prev.title },
          label: { ...seed.label, ...prev.label },
        },
      },
    };
  };
  const withDefaultResultLimit = (cfg: ChartViewConfig): ChartViewConfig => ({
    ...cfg,
    nativeBody: {
      ...cfg.nativeBody,
      deDisplay: {
        ...buildDefaultChartDeDisplay(),
        ...cfg.nativeBody?.deDisplay,
      },
    },
  });
  if (type === "table") {
    return withDefaultResultLimit(
      withDefaultTitleAndLabel(
      withTableColumnWidthDefault({
      chartType: "table",
      ...base,
      dimensions: [],
      metrics: [],
    }),
    ),
    );
  }
  if (type === "kpi") {
    return withDefaultResultLimit(
      withDefaultTitleAndLabel(
      withLegendDefault({
      chartType: "kpi",
      ...base,
      dimensions: [],
      metrics: [],
    }),
    ),
    );
  }
  if (type === "map-3d") {
    return withDefaultResultLimit(
      withDefaultTitleAndLabel(
      withLegendDefault({
      chartType: "map-3d",
      ...base,
      dimensions: [],
      metrics: [],
      nativeBody: {
        deStyle: {
          ...DEFAULT_MAP_3D_CHART_DE_STYLE,
        },
      },
    }),
    ),
    );
  }
  if (type === "gis-map") {
    return withDefaultResultLimit(
      withDefaultTitleAndLabel(
      withLegendDefault({
      chartType: "gis-map",
      ...base,
      dimensions: [],
      metrics: [],
      nativeBody: {
        ...defaultGisProjectNativeBody(),
      },
    }),
    ),
    );
  }
  return withDefaultResultLimit(
    withDefaultTitleAndLabel(
    withTableColumnWidthDefault(
    withLegendDefault(
      withRadarDefaultDeStyle(
        withTreemapDefaultDeStyle(
          withPieDefaultDeStyle({
    chartType: type,
    ...base,
            dimensions: [],
            metrics: [],
          }),
        ),
      ),
    ),
    ),
    ),
  );
}
