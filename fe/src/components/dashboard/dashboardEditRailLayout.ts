/** DataEase chart-edit 双列默认总宽 */
export const DASHBOARD_EDIT_RAIL_WIDTH_PX = 432;

export const DASHBOARD_EDIT_RAIL_MIN_WIDTH_PX = 300;
export const DASHBOARD_EDIT_RAIL_MAX_WIDTH_PX = 720;
export const DASHBOARD_EDIT_RAIL_WIDTH_STORAGE_KEY = "vitalspan:dashboard-edit-rail-width-px";

/** 收起后的竖条宽（与 {@link CollapsedRailTab} `w-8` 一致） */
export const DASHBOARD_EDIT_RAIL_COLLAPSED_TAB_WIDTH_PX = 32;

/** 图表编辑左列：数据/样式/高级配置 */
export const DASHBOARD_EDIT_RAIL_LEFT_COLUMN_CLASS = "min-w-0 flex-[236] basis-0";

/** 图表编辑右列：数据集与字段库（加宽以避免名称截断） */
export const DASHBOARD_EDIT_RAIL_RIGHT_COLUMN_CLASS = "min-w-0 flex-[196] basis-0";

/** 双列均展开时的 grid 列宽比（236:196 ≈ 左配置 : 右数据集） */
export function resolveWidgetEditRailGridColumns(leftOpen: boolean, rightOpen: boolean): string {
  const tab = `${DASHBOARD_EDIT_RAIL_COLLAPSED_TAB_WIDTH_PX}px`;
  if (leftOpen && rightOpen) {
    return "minmax(0,236fr) minmax(0,196fr)";
  }
  if (leftOpen && !rightOpen) {
    return `minmax(0,1fr) ${tab}`;
  }
  if (!leftOpen && rightOpen) {
    return `${tab} minmax(0,1fr)`;
  }
  return `${tab} ${tab}`;
}

/** @deprecated 使用 {@link DASHBOARD_EDIT_RAIL_LEFT_COLUMN_CLASS} / {@link DASHBOARD_EDIT_RAIL_RIGHT_COLUMN_CLASS} */
export const DASHBOARD_EDIT_RAIL_COLUMN_CLASS = DASHBOARD_EDIT_RAIL_LEFT_COLUMN_CLASS;

/** 右栏外壳：宽度由调用方 style 或 {@link DASHBOARD_EDIT_RAIL_SHELL_FIXED_WIDTH_CLASS} 控制 */
export const DASHBOARD_EDIT_RAIL_SHELL_CLASS = "shrink-0";

/** 组件库编辑等无画布拖拽场景：固定默认总宽 */
export const DASHBOARD_EDIT_RAIL_SHELL_FIXED_WIDTH_CLASS =
  "w-[432px] max-w-[min(100%,432px)] shrink-0";

export function clampDashboardEditRailWidth(
  widthPx: number,
  viewportWidth?: number,
): number {
  const viewport =
    viewportWidth ?? (typeof window !== "undefined" ? window.innerWidth : 1280);
  const max = Math.min(
    DASHBOARD_EDIT_RAIL_MAX_WIDTH_PX,
    Math.max(DASHBOARD_EDIT_RAIL_MIN_WIDTH_PX, Math.round(viewport * 0.62)),
  );
  return Math.min(max, Math.max(DASHBOARD_EDIT_RAIL_MIN_WIDTH_PX, Math.round(widthPx)));
}

export function readStoredDashboardEditRailWidth(): number {
  if (typeof window === "undefined") return DASHBOARD_EDIT_RAIL_WIDTH_PX;
  try {
    const raw = window.localStorage.getItem(DASHBOARD_EDIT_RAIL_WIDTH_STORAGE_KEY);
    if (!raw) return DASHBOARD_EDIT_RAIL_WIDTH_PX;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return DASHBOARD_EDIT_RAIL_WIDTH_PX;
    return clampDashboardEditRailWidth(parsed);
  } catch {
    return DASHBOARD_EDIT_RAIL_WIDTH_PX;
  }
}

export function writeStoredDashboardEditRailWidth(widthPx: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      DASHBOARD_EDIT_RAIL_WIDTH_STORAGE_KEY,
      String(clampDashboardEditRailWidth(widthPx)),
    );
  } catch {
    // ignore
  }
}

export function resolveDashboardEditRailWidthOnDrag(
  startWidthPx: number,
  pointerDeltaX: number,
  viewportWidth?: number,
): number {
  return clampDashboardEditRailWidth(startWidthPx - pointerDeltaX, viewportWidth);
}

export function dashboardEditRailShellWidthStyle(widthPx: number): { width: number; maxWidth: string } {
  const safe = clampDashboardEditRailWidth(widthPx);
  return { width: safe, maxWidth: `min(100%, ${safe}px)` };
}

/** 看板编辑右栏外壳视觉（展开壳 / 收起竖条共用圆角边框） */
export const DASHBOARD_EDIT_RAIL_SHELL_CHROME_CLASS =
  "rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.02]";

/** @deprecated 右栏已统一为 {@link DASHBOARD_EDIT_RAIL_SHELL_CLASS} */
export const DASHBOARD_EDIT_RAIL_NARROW_SHELL_CLASS = DASHBOARD_EDIT_RAIL_SHELL_CLASS;

/**
 * 看板编辑右栏滚动。
 * - 壳层 `…-clip` 裁剪；`…-pass-through` 透传高度，供 ChartInspectorTabs 等面板内滚动
 * - `…-scroll` 供仪表板配置 / 大屏画布设置等长内容整体滚动（见 DashboardEditPage chartRail）
 */
export const DASHBOARD_EDIT_RAIL_SCROLL_CLIP_CLASS =
  "dashboard-edit-rail-scroll-clip h-0 min-h-0 flex-1 overflow-hidden px-2 py-1";

/** 高度透传：子级 flex 链获得固定高度后在面板内滚动 */
export const DASHBOARD_EDIT_RAIL_PASS_THROUGH_CLASS =
  "flex h-full min-h-0 min-w-0 flex-col overflow-hidden";

export const DASHBOARD_EDIT_RAIL_SCROLL_CLASS =
  "dashboard-edit-rail-scroll h-full min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain";

/** @deprecated 滚动已上移至 {@link DASHBOARD_EDIT_RAIL_SCROLL_CLASS}；保留别名避免遗漏引用 */
export const DASHBOARD_CONFIG_RAIL_SCROLL_CLASS = DASHBOARD_EDIT_RAIL_SCROLL_CLASS;

export const DASHBOARD_CONFIG_RAIL_CONTENT_CLASS = "w-full";

/** @deprecated 使用 {@link DASHBOARD_CONFIG_RAIL_CONTENT_CLASS}；固定宽由 {@link DASHBOARD_EDIT_RAIL_SHELL_CLASS} 承担 */
export const DASHBOARD_EDIT_RAIL_CONTENT_WIDTH_CLASS = DASHBOARD_CONFIG_RAIL_CONTENT_CLASS;
