import { readCanvasSurfaceKind, resolvePersistedCanvasMinHeight } from "@/lib/canvasPersistPolicy";
import type { DashboardCanvas, DashboardLayoutV2 } from "../layoutUtils";
import { getTopLevelPixelWidgets } from "../layoutUtils";
import type { PixelRect } from "./geometry";

export const PIXEL_CANVAS_GUTTER = 0;

/** 保留导出供历史测试引用；DE 模型不在拖动中推挤邻组件 */
export const PIXEL_PREVIEW_THROTTLE_MS = 32;

export function canvasScaleForHost(
  hostWidth: number,
  canvasWidth: number,
  gutter = PIXEL_CANVAS_GUTTER,
): number {
  if (hostWidth <= gutter || canvasWidth <= 0) return 1;
  return (hostWidth - gutter) / canvasWidth;
}

export function fitCanvasHeightToContent(
  layout: DashboardLayoutV2,
  minHeight?: number,
): DashboardLayoutV2 {
  if (readCanvasSurfaceKind(layout) === "data-screen") {
    return layout;
  }
  const resolvedMin = minHeight ?? resolvePersistedCanvasMinHeight(layout);
  const lowest = getTopLevelPixelWidgets(layout.widgets).reduce(
    (max, widget) => Math.max(max, widget.y + widget.height),
    0,
  );
  const height = Math.max(resolvedMin, lowest);
  if (height === layout.canvas.height) return layout;
  return {
    ...layout,
    canvas: {
      ...layout.canvas,
      height,
    },
  };
}

export function visibleCanvasViewport(
  host: Pick<HTMLElement, "scrollLeft" | "scrollTop" | "clientWidth" | "clientHeight">,
  scale: number,
  canvas: DashboardCanvas,
): PixelRect {
  const safeScale = scale > 0 ? scale : 1;
  const hiddenGutter = Math.min(host.scrollLeft, PIXEL_CANVAS_GUTTER);
  const x = Math.max(0, (host.scrollLeft - PIXEL_CANVAS_GUTTER) / safeScale);
  const y = host.scrollTop / safeScale;
  return {
    x,
    y,
    width: Math.min(
      canvas.width - x,
      (host.clientWidth - PIXEL_CANVAS_GUTTER + hiddenGutter) / safeScale,
    ),
    height: Math.min(canvas.height - y, host.clientHeight / safeScale),
  };
}
