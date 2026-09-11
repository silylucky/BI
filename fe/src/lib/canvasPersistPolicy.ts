import type { DashboardLayout } from "@/components/dashboard/layoutUtils";
import type { DashboardStyleConfig } from "@/components/dashboard/dashboardStyleConfig";

/** 与 backend `MIN_CANVAS_HEIGHT` 对齐 */
export const PERSISTED_CANVAS_MIN_HEIGHT = 900;

export const DATA_SCREEN_CANVAS = {
  width: 1920,
  height: 1080,
} as const;

export type CanvasSurfaceKind = "dashboard" | "data-screen";

type SurfaceKindInput =
  | Pick<DashboardLayout, "styleConfig">
  | DashboardStyleConfig
  | null
  | undefined;

function resolveSurfaceKindValue(input: SurfaceKindInput): CanvasSurfaceKind {
  if (!input) return "dashboard";
  if ("styleConfig" in input) {
    return input.styleConfig?.surfaceKind === "data-screen" ? "data-screen" : "dashboard";
  }
  return input.surfaceKind === "data-screen" ? "data-screen" : "dashboard";
}

export function readCanvasSurfaceKind(input?: SurfaceKindInput): CanvasSurfaceKind {
  return resolveSurfaceKindValue(input);
}

/** 持久化 PUT /layout 时 canvas.height 不得低于此值 */
export function resolvePersistedCanvasMinHeight(
  layout?: Pick<DashboardLayout, "styleConfig" | "canvas"> | null,
): number {
  if (readCanvasSurfaceKind(layout) === "data-screen") {
    return layout?.canvas?.height ?? DATA_SCREEN_CANVAS.height;
  }
  return PERSISTED_CANVAS_MIN_HEIGHT;
}

/** 保存前最终钳制：大屏固定 16:9 基线，普通看板不低于后端契约 */
export function clampCanvasHeightForPersist(
  layout: Extract<DashboardLayout, { version: 2 }>,
  minHeight = resolvePersistedCanvasMinHeight(layout),
): Extract<DashboardLayout, { version: 2 }> {
  if (readCanvasSurfaceKind(layout) === "data-screen") {
    return layout;
  }
  const lowest = layout.widgets.reduce(
    (max, widget) => Math.max(max, widget.y + widget.height),
    0,
  );
  const height = Math.max(minHeight, lowest);
  if (height === layout.canvas.height) return layout;
  return {
    ...layout,
    canvas: { ...layout.canvas, height },
  };
}
