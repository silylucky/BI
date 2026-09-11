import { readSurfaceKind } from "@/lib/dataScreenLayout";
import type { DashboardLayoutV2, DashboardStyleConfig } from "../layoutUtils";
import {
  reconcileTabPaneChildIdsInPixelLayout,
  repairUnparkedTabChildren,
  syncParkedTabChildren,
  normalizeLayerOrders,
} from "../layoutUtils";
import { layoutsOverlap, packPixelLayoutSeamless } from "./collisionLayout";
import { clampPixelRectToCanvas } from "./geometry";
import { fitCanvasHeightToContent } from "./pixelCanvasHost";

/** 顶层组件收进画布边界；Tab 子组件随宿主同步 park 坐标 */
export function clampPixelLayoutToCanvasBounds(layout: DashboardLayoutV2): DashboardLayoutV2 {
  const canvas = layout.canvas;
  let changed = false;
  const widgets = layout.widgets.map((widget) => {
    if (widget.parentTabsId) return widget;
    const next = clampPixelRectToCanvas(widget, canvas);
    if (
      next.x === widget.x &&
      next.y === widget.y &&
      next.width === widget.width &&
      next.height === widget.height
    ) {
      return widget;
    }
    changed = true;
    return { ...widget, ...next };
  });
  if (!changed) return layout;
  return {
    ...layout,
    widgets: syncParkedTabChildren(widgets),
  };
}

/** 编辑态轻量修复：Tab park + 子组件折叠，不触发 pack（避免拖动中整版重排） */
export function repairPixelLayoutTabState(layout: DashboardLayoutV2): DashboardLayoutV2 {
  const reconciled = reconcileTabPaneChildIdsInPixelLayout(layout);
  const widgets = syncParkedTabChildren(repairUnparkedTabChildren(reconciled.widgets));
  const repaired = { ...reconciled, widgets };
  if (readSurfaceKind(layout) === "data-screen") {
    return repaired;
  }
  return fitCanvasHeightToContent(repaired);
}

/**
 * 加载 / 保存 / 展示前统一消毒：
 * 1. Tab 归属对齐 2. 未 park 子组件折叠
 * 3. 仪表板：仅在显式 packOverlaps 时 pack 重叠块
 *
 * 零间隙外框压实仅由间隙配置变更触发（DashboardEditPage.applyStyleConfig），
 * 禁止在 save/load 隐式 compact，避免保存后坐标突变或交错布局被挤叠。
 */
export function sanitizePixelLayoutGeometry(
  layout: DashboardLayoutV2,
  style?: DashboardStyleConfig | null,
  options?: { packOverlaps?: boolean },
): DashboardLayoutV2 {
  const isDataScreen = readSurfaceKind(style ?? layout) === "data-screen";
  let prepared = layout;
  prepared = repairPixelLayoutTabState(prepared);
  const hasOverlap = layoutsOverlap(prepared, 0);
  const shouldPack = !isDataScreen && hasOverlap && options?.packOverlaps === true;
  if (shouldPack) {
    prepared = packPixelLayoutSeamless(prepared);
  }
  const normalizedWidgets = normalizeLayerOrders(prepared.widgets);
  if (normalizedWidgets !== prepared.widgets) {
    prepared = { ...prepared, widgets: normalizedWidgets as typeof prepared.widgets };
  }
  if (isDataScreen) {
    return clampPixelLayoutToCanvasBounds(prepared);
  }
  return fitCanvasHeightToContent(prepared);
}
