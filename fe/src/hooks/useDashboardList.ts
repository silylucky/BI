import { useQuery } from "@tanstack/react-query";
import type { DashboardLayout } from "@/components/dashboard/layoutUtils";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";

export type DashboardListItem = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  layoutJson?: DashboardLayout;
  updatedAt: string;
};

type DashboardListResponse = {
  items: DashboardListItem[];
  total: number;
  limit: number;
  offset: number;
};

type UseDashboardListOptions = {
  enabled?: boolean;
  limit?: number;
};

export function useDashboardList({ enabled = true, limit = 100 }: UseDashboardListOptions = {}) {
  return useQuery({
    queryKey: queryKeys.dashboards.list({ limit, offset: 0 }),
    queryFn: () =>
      apiFetch<DashboardListResponse>(`/api/v1/dashboards?limit=${limit}&offset=0`),
    enabled,
    staleTime: 60_000,
  });
}
