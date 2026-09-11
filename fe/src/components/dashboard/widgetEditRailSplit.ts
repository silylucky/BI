/** 图表编辑双列默认比例（与 dashboardEditRailLayout 236:196 一致） */
export const WIDGET_EDIT_RAIL_DEFAULT_LEFT_RATIO = 236 / (236 + 196);

export const WIDGET_EDIT_RAIL_SPLIT_STORAGE_KEY = "vitalspan:widget-edit-rail-left-ratio";

export const WIDGET_EDIT_RAIL_LEFT_MIN_PX = 152;
export const WIDGET_EDIT_RAIL_RIGHT_MIN_PX = 136;
export const WIDGET_EDIT_RAIL_RESIZE_HANDLE_PX = 5;

export function clampWidgetEditRailLeftRatio(ratio: number, containerWidth: number): number {
  if (!Number.isFinite(containerWidth) || containerWidth <= 0) {
    return WIDGET_EDIT_RAIL_DEFAULT_LEFT_RATIO;
  }
  const handle = WIDGET_EDIT_RAIL_RESIZE_HANDLE_PX;
  const available = Math.max(containerWidth - handle, 1);
  const minRatio = WIDGET_EDIT_RAIL_LEFT_MIN_PX / available;
  const maxRatio = 1 - WIDGET_EDIT_RAIL_RIGHT_MIN_PX / available;
  if (maxRatio < minRatio) {
    return WIDGET_EDIT_RAIL_DEFAULT_LEFT_RATIO;
  }
  return Math.min(maxRatio, Math.max(minRatio, ratio));
}

export function readStoredWidgetEditRailLeftRatio(): number {
  if (typeof window === "undefined") return WIDGET_EDIT_RAIL_DEFAULT_LEFT_RATIO;
  try {
    const raw = window.localStorage.getItem(WIDGET_EDIT_RAIL_SPLIT_STORAGE_KEY);
    if (!raw) return WIDGET_EDIT_RAIL_DEFAULT_LEFT_RATIO;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed >= 1) {
      return WIDGET_EDIT_RAIL_DEFAULT_LEFT_RATIO;
    }
    return parsed;
  } catch {
    return WIDGET_EDIT_RAIL_DEFAULT_LEFT_RATIO;
  }
}

export function writeStoredWidgetEditRailLeftRatio(ratio: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WIDGET_EDIT_RAIL_SPLIT_STORAGE_KEY, String(ratio));
  } catch {
    // ignore quota / private mode
  }
}
