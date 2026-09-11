import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { DashboardWidgetBase } from "@/components/dashboard/dashboardLayoutContracts";
import { isEmbedShareContext } from "@/lib/api";
import { buildComponentMap } from "@/lib/resolveVizComponent";
import { batchResolveVizComponents, collectComponentIds } from "@/lib/vizComponents";
import { queryKeys } from "@/lib/queryKeys";

export function useVizComponentMap(widgets: DashboardWidgetBase[]) {
  const ids = useMemo(() => collectComponentIds(widgets), [widgets]);
  const embedMode = isEmbedShareContext();

  const needsResolve = ids.length > 0 && !embedMode;

  const query = useQuery({
    queryKey: queryKeys.vizComponents.resolve(ids),
    queryFn: () => batchResolveVizComponents(ids),
    enabled: needsResolve,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  const componentMap = useMemo(
    () => buildComponentMap(query.data?.items ?? []),
    [query.data?.items],
  );

  return {
    componentMap,
    isLoading: needsResolve && (query.isPending || query.isFetching),
    isFetched: needsResolve && query.isFetched,
    isError: needsResolve && query.isError,
    refetch: query.refetch,
  };
}
