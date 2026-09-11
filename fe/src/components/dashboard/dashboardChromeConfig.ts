import type { CSSProperties } from "react";
import type {
  DashboardAlignmentSnapConfig,
  DashboardChromeConfig,
  DashboardStyleConfig,
} from "./dashboardStyleConfig";
import { PIXEL_COLLISION_OVERLAP_BUFFER_PX } from "./pixelCanvas/collisionLayout";

export const DEFAULT_DASHBOARD_CHROME: Required<
  Pick<
    DashboardChromeConfig,
    | "showChartLoadingHint"
    | "showFloatingActions"
    | "showChartActionButtons"
    | "showAuxiliaryGrid"
  >
> = {
  showChartLoadingHint: true,
  /** 编辑态组件右键菜单（style JSON 历史字段名 showFloatingActions） */
  showFloatingActions: true,
  showChartActionButtons: true,
  showAuxiliaryGrid: true,
};

export const DEFAULT_DRILL_LEVEL_COLORS = ["#465fff", "#0ba5ec", "#12b76a"] as const;

/** 辅助对齐网格默认步长（像素画布 overlay） */
export const AUXILIARY_GRID_CELL_PX = 20;

export const DEFAULT_MARK_LINE_THRESHOLD_PX = 10;
export const MIN_MARK_LINE_THRESHOLD_PX = 2;
export const MAX_MARK_LINE_THRESHOLD_PX = 24;

export const DEFAULT_COLLISION_OVERLAP_BUFFER_PX = PIXEL_COLLISION_OVERLAP_BUFFER_PX;
export const MIN_COLLISION_OVERLAP_BUFFER_PX = 0;
export const MAX_COLLISION_OVERLAP_BUFFER_PX = 80;
export const MIN_GRID_CELL_PX = 8;
export const MAX_GRID_CELL_PX = 48;

export type ResolvedDashboardAlignmentSnap = {
  enableMarkLineSnap: boolean;
  collisionOverlapBufferPx: number;
  markLineThresholdPx: number;
  gridCellPx: number;
  snapEdges: boolean;
  snapCenters: boolean;
};

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function resolveDashboardChrome(
  config: DashboardStyleConfig | undefined,
): typeof DEFAULT_DASHBOARD_CHROME {
  const chrome = config?.chrome ?? {};
  return {
    showChartLoadingHint: chrome.showChartLoadingHint !== false,
    showFloatingActions: chrome.showFloatingActions !== false,
    showChartActionButtons: chrome.showChartActionButtons !== false,
    showAuxiliaryGrid: chrome.showAuxiliaryGrid !== false,
  };
}

export function resolveDashboardAlignmentSnap(
  config: DashboardStyleConfig | undefined,
): ResolvedDashboardAlignmentSnap {
  const chrome = resolveDashboardChrome(config);
  const snap: DashboardAlignmentSnapConfig = config?.chrome?.alignmentSnap ?? {};
  return {
    enableMarkLineSnap: snap.enableMarkLineSnap ?? chrome.showAuxiliaryGrid,
    collisionOverlapBufferPx: clampInt(
      snap.collisionOverlapBufferPx ?? DEFAULT_COLLISION_OVERLAP_BUFFER_PX,
      MIN_COLLISION_OVERLAP_BUFFER_PX,
      MAX_COLLISION_OVERLAP_BUFFER_PX,
    ),
    markLineThresholdPx: clampInt(
      snap.markLineThresholdPx ?? DEFAULT_MARK_LINE_THRESHOLD_PX,
      MIN_MARK_LINE_THRESHOLD_PX,
      MAX_MARK_LINE_THRESHOLD_PX,
    ),
    gridCellPx: clampInt(snap.gridCellPx ?? AUXILIARY_GRID_CELL_PX, MIN_GRID_CELL_PX, MAX_GRID_CELL_PX),
    snapEdges: snap.snapEdges !== false,
    snapCenters: snap.snapCenters !== false,
  };
}

export function resolveDrillLevelColors(config: DashboardStyleConfig | undefined): string[] {
  const custom = config?.drillLevelColors?.filter(Boolean);
  if (custom && custom.length > 0) return custom;
  return [...DEFAULT_DRILL_LEVEL_COLORS];
}

export function resolveDialogScopeStyle(
  config: DashboardStyleConfig | undefined,
): CSSProperties {
  const style: CSSProperties = {};
  const dialogStyle = config?.dialogStyle;
  if (dialogStyle?.background) {
    (style as Record<string, string>)["--dashboard-dialog-bg"] = dialogStyle.background;
  }
  if (dialogStyle?.fontColor) {
    (style as Record<string, string>)["--dashboard-dialog-fg"] = dialogStyle.fontColor;
  }
  resolveDrillLevelColors(config).forEach((color, index) => {
    (style as Record<string, string>)[`--dashboard-drill-level-${index}`] = color;
  });
  return style;
}

/** 编辑态辅助网格（固定步长 AUXILIARY_GRID_CELL_PX） */
export function auxiliaryGridPatternStyle(
  scheme: "light" | "dark" = "light",
  cellPx = AUXILIARY_GRID_CELL_PX,
): CSSProperties {
  const cell = clampInt(cellPx, MIN_GRID_CELL_PX, MAX_GRID_CELL_PX);
  const stroke = scheme === "dark" ? "%23cbd5e1" : "%23475569";
  const svg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${cell}" height="${cell}"><path fill="none" stroke="${stroke}" stroke-width="1.5" d="M${cell} 0H0v${cell}"/></svg>`,
  );
  return {
    backgroundImage: `url("data:image/svg+xml,${svg}")`,
    backgroundSize: `${cell}px ${cell}px`,
    backgroundRepeat: "repeat",
  };
}

/** @deprecated 使用 mergeAuxiliaryGridIntoSurface */
export function auxiliaryGridOverlayStyle(scheme: "light" | "dark" = "light"): CSSProperties {
  return auxiliaryGridPatternStyle(scheme);
}

/** 将辅助网格叠在现有画布底色/装饰之上（仅编辑态） */
export function mergeAuxiliaryGridIntoSurface(
  base: CSSProperties,
  scheme: "light" | "dark",
  enabled: boolean,
  cellPx = AUXILIARY_GRID_CELL_PX,
): CSSProperties {
  if (!enabled) return base;
  const pattern = auxiliaryGridPatternStyle(scheme, cellPx);
  const layers = [pattern.backgroundImage, base.backgroundImage].filter(Boolean);
  const sizes = [pattern.backgroundSize, base.backgroundSize].filter(Boolean);
  if (layers.length === 0) return base;
  return {
    ...base,
    backgroundImage: layers.join(", "),
    backgroundSize: sizes.join(", "),
    backgroundRepeat: base.backgroundRepeat ?? "repeat",
  };
}
