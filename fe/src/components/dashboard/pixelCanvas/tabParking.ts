import {
  COLLISION_COMMIT_MIN_OVERLAP_PX,
  resolvePixelLayoutWithActiveRect,
} from "./collisionLayout";
import type { PixelPoint } from "./geometry";
import { defaultPixelSizeForWidget } from "./createPixelWidget";
import type { DashboardLayoutV2, PixelLayoutWidget } from "../layoutUtils";
import { pointInPixelWidgetWithBuffer } from "../layoutUtils";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function placeAtPoint(
  size: { width: number; height: number },
  canvas: DashboardLayoutV2["canvas"],
  point: PixelPoint,
): Pick<PixelLayoutWidget, "x" | "y" | "width" | "height"> {
  const width = Math.min(size.width, canvas.width);
  const height = Math.min(size.height, canvas.height);
  const x = clamp(Math.round(point.x - width / 2), 0, Math.max(0, canvas.width - width));
  const y = clamp(Math.round(point.y - height / 2), 0, Math.max(0, canvas.height - height));
  return { x, y, width, height };
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

/** 将 Tab 内子组件还原为画布顶层组件（拖出页签） */
export function unparkPixelWidgetFromTab(
  layout: DashboardLayoutV2,
  widgetId: string,
  point: PixelPoint,
): DashboardLayoutV2 {
  const widget = layout.widgets.find((w) => w.id === widgetId);
  if (!widget?.parentTabsId || !widget.tabPaneId) return layout;

  const size = defaultPixelSizeForWidget(widget);
  const placement = placeAtPoint(size, layout.canvas, point);
  const unparked: PixelLayoutWidget = {
    ...widget,
    parentTabsId: undefined,
    tabPaneId: undefined,
    ...placement,
  };

  const widgets = removeWidgetIdFromTabPanes(layout.widgets, widgetId).map((w) =>
    w.id === widgetId ? unparked : w,
  );

  return resolvePixelLayoutWithActiveRect(
    { ...layout, widgets },
    widgetId,
    placement,
    { minOverlap: COLLISION_COMMIT_MIN_OVERLAP_PX },
  );
}

/** 落点已离开所属 Tab 外框时可 unpark */
export function canUnparkTabChildAtPoint(
  layout: DashboardLayoutV2,
  widgetId: string,
  point: PixelPoint,
  dropBufferPx = 0,
): boolean {
  const widget = layout.widgets.find((w) => w.id === widgetId);
  if (!widget?.parentTabsId) return false;
  const parent = layout.widgets.find((w) => w.id === widget.parentTabsId);
  if (!parent) return true;
  return !pointInPixelWidgetWithBuffer(point, parent, dropBufferPx);
}
