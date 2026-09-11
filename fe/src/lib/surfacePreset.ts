import type { DashboardLayoutV2 } from "@/components/dashboard/layoutUtils";
import type { DashboardStyleConfig } from "@/components/dashboard/dashboardStyleConfig";
import { DATA_SCREEN_CANVAS } from "@/lib/canvasPersistPolicy";
import { SCREEN_ACCENT, SCREEN_CANVAS_BG } from "@/lib/screenTokens";
import { PIXEL_CANVAS_MIN_HEIGHT } from "@/components/dashboard/pixelCanvas/constants";

export type SurfaceKind = "dashboard" | "data-screen";

export type DataScreenCanvasPresetId = "16:9" | "21:9";

export const DATA_SCREEN_CANVAS_16_9 = {
  width: DATA_SCREEN_CANVAS.width,
  height: DATA_SCREEN_CANVAS.height,
} as const;

export const DATA_SCREEN_CANVAS_21_9 = {
  width: 2560,
  height: 1080,
} as const;

export const DATA_SCREEN_CANVAS_BOUNDS = {
  minWidth: 800,
  minHeight: 600,
  maxWidth: 7680,
  maxHeight: 4320,
} as const;

export function clampDataScreenCanvasSize(width: number, height: number): {
  width: number;
  height: number;
} {
  return {
    width: Math.round(
      Math.min(
        Math.max(width, DATA_SCREEN_CANVAS_BOUNDS.minWidth),
        DATA_SCREEN_CANVAS_BOUNDS.maxWidth,
      ),
    ),
    height: Math.round(
      Math.min(
        Math.max(height, DATA_SCREEN_CANVAS_BOUNDS.minHeight),
        DATA_SCREEN_CANVAS_BOUNDS.maxHeight,
      ),
    ),
  };
}

export const DATA_SCREEN_CANVAS_PRESETS: Record<
  DataScreenCanvasPresetId,
  { width: number; height: number; label: string }
> = {
  "16:9": { ...DATA_SCREEN_CANVAS_16_9, label: "1920×1080 (16:9)" },
  "21:9": { ...DATA_SCREEN_CANVAS_21_9, label: "2560×1080 (21:9)" },
};

export function resolveDataScreenCanvasPresetId(canvas: {
  width: number;
  height: number;
}): DataScreenCanvasPresetId {
  return canvas.width >= DATA_SCREEN_CANVAS_21_9.width ? "21:9" : "16:9";
}

export type SurfacePreset = {
  kind: SurfaceKind;
  canvas: { width: number; height: number };
  defaultStyle: Partial<DashboardStyleConfig>;
};

const DASHBOARD_PRESET: SurfacePreset = {
  kind: "dashboard",
  canvas: { width: 1440, height: PIXEL_CANVAS_MIN_HEIGHT },
  defaultStyle: {
    surfaceKind: "dashboard",
    colorScheme: "light",
    scaleMode: "canvas",
    chartLabelShow: true,
    titleStyle: { show: true },
  },
};

const DATA_SCREEN_PRESET: SurfacePreset = {
  kind: "data-screen",
  canvas: { width: DATA_SCREEN_CANVAS.width, height: DATA_SCREEN_CANVAS.height },
  defaultStyle: {
    surfaceKind: "data-screen",
    colorScheme: "dark",
    canvasBackground: SCREEN_CANVAS_BG,
    canvasBackgroundCustom: true,
    scaleMode: "canvas",
    gapPreset: "none",
    widgetGap: 0,
    pixelGutter: 0,
    widgetStyle: { opacity: 0 },
    themeAccent: SCREEN_ACCENT,
    refreshIntervalSec: 60,
    chartLabelShow: true,
    titleStyle: { show: true },
  },
};

export function getSurfacePreset(kind: SurfaceKind): SurfacePreset {
  return kind === "data-screen" ? DATA_SCREEN_PRESET : DASHBOARD_PRESET;
}

export function buildDefaultLayoutForSurface(kind: SurfaceKind): DashboardLayoutV2 {
  const preset = getSurfacePreset(kind);
  return {
    version: 2,
    canvas: { ...preset.canvas },
    widgets: [],
    globalFilters: [],
    styleConfig: { ...preset.defaultStyle },
  };
}
