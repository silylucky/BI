import type { PaletteInsertType } from "../createLayoutWidget";
import type { DashboardLayoutV2, PixelLayoutWidget } from "../layoutUtils";
import { toolbarScreenMaterialSkipsTabHost } from "@/lib/screenVisualAssets";
import {
  findTabsHostAtPoint,
  getTopLevelPixelWidgets,
  movePixelWidgetIntoTab,
  pointInPixelWidgetWithBuffer,
} from "../layoutUtils";
import type { PixelRect } from "./geometry";

/** Tab 投放命中外扩（逻辑区，略大于碰撞轻触区 ~40px） */
export const TAB_PALETTE_DROP_BUFFER_PX = 48;

/** 画布虚线高亮外扩（仅视觉，贴近 Tab 外框） */
export const TAB_PALETTE_DROP_VISUAL_BUFFER_PX = 4;

/** 已有组件与 Tab 宿主矩形的最小重叠（画布 px）才视为「拖入」 */
export const TAB_WIDGET_ABSORB_MIN_OVERLAP_PX = 24;

export type TabInsertIntent = {
  tabsWidgetId: string;
  paneId: string;
};

function widgetRectCenter(rect: PixelRect): { x: number; y: number } {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

function rectOverlapsTabHost(
  rect: PixelRect,
  host: Pick<PixelLayoutWidget, "x" | "y" | "width" | "height">,
  minOverlapPx: number,
): boolean {
  const overlapX =
    Math.min(rect.x + rect.width, host.x + host.width) - Math.max(rect.x, host.x);
  const overlapY =
    Math.min(rect.y + rect.height, host.y + host.height) - Math.max(rect.y, host.y);
  return overlapX >= minOverlapPx && overlapY >= minOverlapPx;
}

/** 已有组件拖放：中心点缓冲命中，或外框与 Tab 有足够重叠 */
export function resolveTabHostForWidgetDrop(
  layout: DashboardLayoutV2,
  widgetRect: PixelRect,
  options: {
    intent?: TabInsertIntent | null;
    dropBufferPx?: number;
    minOverlapPx?: number;
  } = {},
): PixelLayoutWidget | undefined {
  const buffer = options.dropBufferPx ?? TAB_PALETTE_DROP_BUFFER_PX;
  const minOverlap = options.minOverlapPx ?? TAB_WIDGET_ABSORB_MIN_OVERLAP_PX;
  const center = widgetRectCenter(widgetRect);

  const atCenter = findTabsHostAtPoint(layout.widgets, center, buffer);
  if (atCenter) return atCenter;

  if (options.intent) {
    const intentHost = layout.widgets.find((w) => w.id === options.intent!.tabsWidgetId);
    if (
      intentHost?.type === "tabs" &&
      intentHost.tabsConfig &&
      pointInPixelWidgetWithBuffer(center, intentHost, buffer)
    ) {
      return intentHost;
    }
  }

  const hosts = getTopLevelPixelWidgets(layout.widgets).filter(
    (w) =>
      w.type === "tabs" &&
      w.tabsConfig &&
      w.width > 0 &&
      w.height > 0 &&
      rectOverlapsTabHost(widgetRect, w, minOverlap),
  );
  if (hosts.length === 0) return undefined;
  return hosts.reduce((best, w) =>
    w.width * w.height < best.width * best.height ? w : best,
  );
}

/** 松手时尝试将顶层组件 park 进 Tab；成功则返回新 layout */
export function tryAbsorbTopLevelWidgetIntoTab(
  layout: DashboardLayoutV2,
  widget: PixelLayoutWidget,
  options: {
    intent?: TabInsertIntent | null;
    dropBufferPx?: number;
    minOverlapPx?: number;
  } = {},
): DashboardLayoutV2 | null {
  if (widget.type === "tabs" || widget.parentTabsId) return null;

  const rect: PixelRect = {
    x: widget.x,
    y: widget.y,
    width: widget.width,
    height: widget.height,
  };
  const host = resolveTabHostForWidgetDrop(layout, rect, options);
  if (!host || host.id === widget.id) return null;

  const paneId = activePaneIdForTabHost(host, options.intent);
  return movePixelWidgetIntoTab(layout, widget.id, host, paneId);
}

/** 调色板插入：装饰类素材落画布视口，不进 Tab 0×0 折叠位 */
export function resolvePaletteInsertTabHost(
  insertType: PaletteInsertType,
  layout: DashboardLayoutV2,
  options: {
    tabsWidgetId?: string | null;
    point?: { x: number; y: number };
    selectedWidgetId?: string | null;
    intent?: TabInsertIntent | null;
    dropBufferPx?: number;
  },
): PixelLayoutWidget | undefined {
  if (insertType === "tabs" || toolbarScreenMaterialSkipsTabHost(insertType)) {
    return undefined;
  }
  return resolveTabPaletteInsertHost(layout, options);
}

/** 对标 DE：统一解析 Tab 投放目标（显式 id > 意图 > DOM > 落点缓冲 > 当前选中 Tab） */
export function resolveTabPaletteInsertHost(
  layout: DashboardLayoutV2,
  options: {
    tabsWidgetId?: string | null;
    point?: { x: number; y: number };
    selectedWidgetId?: string | null;
    intent?: TabInsertIntent | null;
    dropBufferPx?: number;
  },
): PixelLayoutWidget | undefined {
  const buffer = options.dropBufferPx ?? TAB_PALETTE_DROP_BUFFER_PX;

  if (options.tabsWidgetId) {
    const explicit = layout.widgets.find((w) => w.id === options.tabsWidgetId);
    if (explicit?.type === "tabs" && explicit.tabsConfig) return explicit;
  }

  if (options.intent) {
    const fromIntent = layout.widgets.find((w) => w.id === options.intent!.tabsWidgetId);
    if (fromIntent?.type === "tabs" && fromIntent.tabsConfig) return fromIntent;
  }

  if (options.point) {
    const atPoint = findTabsHostAtPoint(layout.widgets, options.point, buffer);
    if (atPoint) return atPoint;
  }

  if (options.selectedWidgetId) {
    const selected = layout.widgets.find((w) => w.id === options.selectedWidgetId);
    if (selected?.type === "tabs" && selected.tabsConfig) return selected;
    if (selected?.parentTabsId) {
      const parentHost = layout.widgets.find(
        (w) => w.id === selected.parentTabsId && w.type === "tabs" && w.tabsConfig,
      );
      if (parentHost) return parentHost;
    }
  }

  return undefined;
}

export function activePaneIdForTabHost(
  host: PixelLayoutWidget,
  intent?: TabInsertIntent | null,
  selectedWidget?: PixelLayoutWidget | null,
): string {
  if (!host.tabsConfig) return "";
  if (intent?.tabsWidgetId === host.id && intent.paneId) {
    const exists = host.tabsConfig.panes.some((p) => p.id === intent.paneId);
    if (exists) return intent.paneId;
  }
  if (selectedWidget?.parentTabsId === host.id && selectedWidget.tabPaneId) {
    const exists = host.tabsConfig.panes.some((p) => p.id === selectedWidget.tabPaneId);
    if (exists) return selectedWidget.tabPaneId;
  }
  return host.tabsConfig.activePaneId;
}
