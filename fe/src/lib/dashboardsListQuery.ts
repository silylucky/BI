import type { DashboardSurfaceKind } from "@/lib/dataScreenLayout";

export type DashboardsListParams = {
  limit: number;
  offset: number;
  surfaceKind?: DashboardSurfaceKind;
  q?: string;
};

export function buildDashboardsListUrl({
  limit,
  offset,
  surfaceKind,
  q,
}: DashboardsListParams): string {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (surfaceKind) {
    params.set("surfaceKind", surfaceKind);
  }
  if (q) {
    params.set("q", q);
  }
  return `/api/v1/dashboards?${params.toString()}`;
}
