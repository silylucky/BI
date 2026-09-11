import type { DashboardLayout, DashboardLayoutV2 } from "@/components/dashboard/layoutUtils";
import type { DashboardStyleConfig } from "@/components/dashboard/dashboardStyleConfig";
import {
  DATA_SCREEN_CANVAS,
  PERSISTED_CANVAS_MIN_HEIGHT,
  readCanvasSurfaceKind,
  resolvePersistedCanvasMinHeight,
} from "@/lib/canvasPersistPolicy";
import {
  buildDefaultLayoutForSurface,
  type SurfaceKind,
} from "@/lib/surfacePreset";

export type DashboardSurfaceKind = SurfaceKind;

export { DATA_SCREEN_CANVAS, PERSISTED_CANVAS_MIN_HEIGHT, resolvePersistedCanvasMinHeight };

export function readSurfaceKind(
  input?: Pick<DashboardLayout, "styleConfig"> | DashboardStyleConfig | null,
): DashboardSurfaceKind {
  return readCanvasSurfaceKind(input);
}

export function isDataScreenLayout(
  layout?: Pick<DashboardLayout, "styleConfig"> | null,
): boolean {
  return readSurfaceKind(layout) === "data-screen";
}

export function buildDefaultDataScreenLayout(): DashboardLayoutV2 {
  return buildDefaultLayoutForSurface("data-screen");
}

export function dataScreenListPath(): string {
  return "/admin/data-screens";
}

export function dataScreenEditPath(id: string): string {
  return `/admin/data-screens/${id}/edit`;
}

export function dataScreenViewPath(id: string): string {
  return `/admin/data-screens/${id}`;
}

export function dataScreenPreviewPath(id: string): string {
  return `/admin/data-screens/${id}/preview`;
}

export function dashboardEditPath(id: string): string {
  return `/admin/dashboards/${id}/edit`;
}

export function dashboardViewPath(id: string): string {
  return `/admin/dashboards/${id}`;
}

export function dashboardPreviewPath(id: string): string {
  return `/admin/dashboards/${id}/preview`;
}

export function isDashboardPreviewPath(pathname: string): boolean {
  return /^\/admin\/dashboards\/[^/]+\/preview\/?$/.test(pathname);
}

export function isDataScreenAdminPath(pathname: string): boolean {
  return pathname.startsWith("/admin/data-screens");
}

export function isDataScreenPreviewPath(pathname: string): boolean {
  return /^\/admin\/data-screens\/[^/]+\/preview\/?$/.test(pathname);
}

export function dataScreenEmbedPath(id: string): string {
  return `/embed/screen/${id}`;
}

export function dashboardSharePath(id: string, isScreen: boolean): string {
  return isScreen ? `/admin/data-screens/${id}/share` : `/admin/dashboards/${id}/share`;
}

export function ensureDataScreenStyleConfig<T extends { surfaceKind?: DashboardSurfaceKind }>(
  style: T,
  isScreen: boolean,
): T {
  if (!isScreen) return style;
  return { ...style, surfaceKind: "data-screen" };
}
