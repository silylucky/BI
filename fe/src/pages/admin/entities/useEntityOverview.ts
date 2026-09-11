import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useEntityStatMetrics } from "./useEntityStatMetrics";

export type EntityTypeOut = {
  typeCode: string;
  displayName: string;
  attributes: { name: string; dataType: string }[];
  lifecycleStates: string[];
};

export type PhysicalTableOut = {
  tableFqn: string;
  displayName: string;
  dataSourceId: string;
  columns: { name: string; dataType: string; nullable?: boolean }[];
  entityTypeCode?: string | null;
};

export type EntityOverviewOut = {
  dashboardId: string;
  entityTypeRef: string;
  statCards: { metricKey: string; label: string; metricSource?: { widgetId: string } | null }[];
  filters: unknown[];
  drillTargets: { widgetId: string; targetDashboardId?: string | null }[];
};

function canViewEntityOverview(roles: string[]): boolean {
  return roles.some((r) => r === "admin" || r === "analyst");
}

export function useEntityOverview() {
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const canRead = canViewEntityOverview(roles);

  const [activeType, setActiveType] = useState<string | null>(null);
  const [dashboardId, setDashboardId] = useState<string>("");
  const [selectedRow, setSelectedRow] = useState<PhysicalTableOut | null>(null);

  const entityTypesQuery = useQuery({
    queryKey: queryKeys.metadata.entityTypes,
    queryFn: () => apiFetch<{ items: EntityTypeOut[] }>("/api/v1/metadata/entity-types"),
    enabled: canRead,
  });

  useEffect(() => {
    const first = entityTypesQuery.data?.items[0]?.typeCode;
    if (first && !activeType) setActiveType(first);
  }, [entityTypesQuery.data, activeType]);

  const physicalQuery = useQuery({
    queryKey: queryKeys.metadata.physicalTables(activeType ?? undefined),
    enabled: Boolean(activeType) && canRead,
    queryFn: () =>
      apiFetch<{ items: PhysicalTableOut[]; total: number }>(
        `/api/v1/metadata/physical-tables?entityTypeCode=${encodeURIComponent(activeType!)}`,
      ),
  });

  const dashboardsQuery = useQuery({
    queryKey: queryKeys.dashboards.list(),
    queryFn: () => apiFetch<{ items: { id: string; name: string }[] }>("/api/v1/dashboards"),
    enabled: canRead,
  });

  useEffect(() => {
    const first = dashboardsQuery.data?.items[0]?.id;
    if (first && !dashboardId) setDashboardId(first);
  }, [dashboardsQuery.data, dashboardId]);

  const overviewQuery = useQuery({
    queryKey: queryKeys.metadata.entityOverview(dashboardId),
    enabled: Boolean(dashboardId) && canRead,
    queryFn: () => apiFetch<EntityOverviewOut>(`/api/v1/dashboards/${dashboardId}/entity-overview`),
  });

  const drillTargetId = useMemo(() => {
    const targets = overviewQuery.data?.drillTargets ?? [];
    return targets.find((t) => t.targetDashboardId)?.targetDashboardId ?? null;
  }, [overviewQuery.data]);

  const entityTypeMismatch =
    Boolean(activeType && overviewQuery.data?.entityTypeRef) &&
    overviewQuery.data!.entityTypeRef !== activeType;

  const activeEntityType = entityTypesQuery.data?.items.find((t) => t.typeCode === activeType) ?? null;

  const statCards = overviewQuery.data?.statCards ?? [];

  const { valuesByMetricKey, loading: statMetricsLoading } = useEntityStatMetrics(
    dashboardId,
    statCards,
    canRead && Boolean(dashboardId),
  );

  return {
    canRead,
    activeType,
    setActiveType,
    dashboardId,
    setDashboardId,
    selectedRow,
    setSelectedRow,
    entityTypesQuery,
    physicalQuery,
    dashboardsQuery,
    overviewQuery,
    drillTargetId,
    entityTypeMismatch,
    activeEntityType,
    entityTypes: entityTypesQuery.data?.items ?? [],
    physicalItems: physicalQuery.data?.items ?? [],
    statCards,
    valuesByMetricKey,
    statMetricsLoading,
  };
}
