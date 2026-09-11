import { isExportSnapshotPath } from "@/lib/appBasePath";

export function getExportTokenFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("token");
}

export function isExportSnapshotContext(): boolean {
  if (typeof window === "undefined") return false;
  return isExportSnapshotPath();
}

export function getExportAuthHeaders(dashboardId: string): Record<string, string> {
  const token = getExportTokenFromLocation();
  if (!token) return {};
  return {
    "X-Export-Token": token,
    "X-Export-Dashboard-Id": dashboardId,
  };
}

export function resolveExportQueryExecutePath(): string {
  return isExportSnapshotContext()
    ? "/api/v1/dashboards/export-query/execute"
    : "/api/v1/query/execute";
}

export async function fetchExportLayout(dashboardId: string, token: string) {
  const qs = new URLSearchParams({ token });
  const response = await fetch(
    `/api/v1/dashboards/${dashboardId}/export-layout?${qs.toString()}`,
  );
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(typeof body.message === "string" ? body.message : "Export token 无效");
  }
  return response.json() as Promise<{
    id: string;
    name: string;
    layoutJson: import("@/components/dashboard/layoutUtils").DashboardLayout;
    surfaceKind: "dashboard" | "data-screen";
  }>;
}
