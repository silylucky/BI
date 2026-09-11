import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";

export type CenterFavorite = { resourceType: string; resourceId: string };
export type CenterRecent = CenterFavorite & {
  resourceLabel?: string;
  viewedAt?: string;
};

export type CenterPreferences = {
  favorites: CenterFavorite[];
  recent: CenterRecent[];
};

export function useReportCenterPreferences() {
  return useQuery({
    queryKey: queryKeys.reports.centerPreferences,
    queryFn: () => apiFetch<CenterPreferences>("/api/v1/reports/center/preferences"),
  });
}

export function useReportCenterPreferenceMutations() {
  const qc = useQueryClient();

  const saveFavorites = useMutation({
    mutationFn: (favorites: CenterFavorite[]) =>
      apiFetch<CenterPreferences>("/api/v1/reports/center/preferences", {
        method: "PUT",
        body: JSON.stringify({ favorites, recent: [] }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.reports.centerPreferences }),
  });

  const recordRecent = useMutation({
    mutationFn: (entry: CenterRecent) =>
      apiFetch<void>("/api/v1/reports/center/recent", {
        method: "POST",
        body: JSON.stringify(entry),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.reports.centerPreferences }),
  });

  return { saveFavorites, recordRecent };
}

export function toggleFavorite(
  favorites: CenterFavorite[],
  resourceType: string,
  resourceId: string,
): CenterFavorite[] {
  const exists = favorites.some(
    (f) => f.resourceType === resourceType && f.resourceId === resourceId,
  );
  if (exists) {
    return favorites.filter(
      (f) => !(f.resourceType === resourceType && f.resourceId === resourceId),
    );
  }
  return [...favorites, { resourceType, resourceId }];
}
