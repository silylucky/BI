export type DashboardSurfaceViewMode = "grid" | "list";

export type DashboardSurfaceListKind = "dashboard" | "data-screen";

const STORAGE_KEY = "vs:dashboard-surface-list-view-mode";

function isViewMode(value: unknown): value is DashboardSurfaceViewMode {
  return value === "grid" || value === "list";
}

export function readDashboardSurfaceListViewMode(
  surface: DashboardSurfaceListKind,
): DashboardSurfaceViewMode {
  if (typeof window === "undefined") return "grid";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return "grid";
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const mode = parsed[surface];
    return isViewMode(mode) ? mode : "grid";
  } catch {
    return "grid";
  }
}

export function writeDashboardSurfaceListViewMode(
  surface: DashboardSurfaceListKind,
  mode: DashboardSurfaceViewMode,
): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const current =
      raw ? (JSON.parse(raw) as Record<string, DashboardSurfaceViewMode>) : {};
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...current, [surface]: mode }),
    );
  } catch {
    /* ignore quota / private mode */
  }
}
