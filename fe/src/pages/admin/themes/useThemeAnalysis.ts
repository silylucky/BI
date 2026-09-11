import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useAuth } from "@/context/auth-context";

export type ThemeDimension = { dimensionId: string; label?: string | null; sortOrder?: number };

export type ThemeConfig = {
  entityType: string;
  timeGranularity: string;
  refType: string;
  refId: string;
  dimensions: ThemeDimension[];
  chartViewBindings?: Array<{ widgetId: string; dimensionId?: string | null }>;
};

export type DrillResult = { columns: string[]; rows: unknown[][] };

export type ChartBindingItem = { widgetId: string; dimensionId?: string | null };

export type ExecutePlanResult = {
  planVersion: string;
  compareWindow?: {
    current: { start: string; end: string };
    baseline: { start: string; end: string };
  } | null;
};

const GRANULARITIES = ["day", "week", "month", "yoy", "mom"] as const;

function isValidUuid(value: string | undefined): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function useThemeAnalysis() {
  const { dashboardId: routeDashboardId } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedDashboardId, setSelectedDashboardId] = useState<string>("");
  const [activeDimensionId, setActiveDimensionId] = useState<string>("");
  const [draftDimensions, setDraftDimensions] = useState<ThemeDimension[]>([
    { dimensionId: "region", label: "区域" },
  ]);
  const [draftGranularity, setDraftGranularity] = useState<string>("day");
  const [draftEntityType, setDraftEntityType] = useState<string>("equipment");
  const [regionFilter, setRegionFilter] = useState<string | null>(null);

  const dashboardsQuery = useQuery({
    queryKey: queryKeys.dashboards.list(),
    queryFn: () => apiFetch<{ items: Array<{ id: string; name: string }> }>("/api/v1/dashboards"),
  });

  const effectiveDashboardId = useMemo(() => {
    if (isValidUuid(routeDashboardId)) return routeDashboardId!;
    if (isValidUuid(selectedDashboardId)) return selectedDashboardId;
    const first = dashboardsQuery.data?.items?.[0]?.id;
    return first ?? "";
  }, [routeDashboardId, selectedDashboardId, dashboardsQuery.data]);

  const refType = "dashboard";
  const refId = effectiveDashboardId;

  const configQuery = useQuery({
    queryKey: queryKeys.themes.config(refType, refId),
    queryFn: () =>
      apiFetch<ThemeConfig>(
        `/api/v1/dashboards/theme-analysis?refType=${encodeURIComponent(refType)}&refId=${encodeURIComponent(refId)}`,
      ),
    enabled: Boolean(refId),
    retry: false,
  });

  const chartBindingsQuery = useQuery({
    queryKey: queryKeys.themes.chartBindings(refType, refId),
    queryFn: () =>
      apiFetch<{ bindings: ChartBindingItem[]; linkedWidgetCount: number }>(
        `/api/v1/dashboards/theme-analysis/chart-bindings?refType=${encodeURIComponent(refType)}&refId=${encodeURIComponent(refId)}`,
      ),
    enabled: Boolean(refId) && Boolean(configQuery.data),
    retry: false,
  });

  const executePlanQuery = useQuery({
    queryKey: ["themes", "executePlan", refType, refId],
    queryFn: () =>
      apiFetch<ExecutePlanResult>("/api/v1/dashboards/theme-analysis/execute-plan", {
        method: "POST",
        body: JSON.stringify({ refType, refId }),
      }),
    enabled: Boolean(refId) && Boolean(configQuery.data),
    retry: false,
  });

  const drillQuery = useQuery({
    queryKey: queryKeys.themes.drill(refType, refId, activeDimensionId, regionFilter),
    queryFn: () =>
      apiFetch<DrillResult>("/api/v1/dashboards/theme-analysis/query", {
        method: "POST",
        body: JSON.stringify({
          refType,
          refId,
          dimensionId: activeDimensionId,
          filters: regionFilter ? { region: regionFilter } : undefined,
        }),
      }),
    enabled: Boolean(refId) && Boolean(configQuery.data) && Boolean(activeDimensionId),
    retry: false,
  });

  const geoMapQuery = useQuery({
    queryKey: ["themes", "geoMap", refType, refId],
    queryFn: () =>
      apiFetch<DrillResult>("/api/v1/dashboards/theme-analysis/query", {
        method: "POST",
        body: JSON.stringify({ refType, refId, dimensionId: "region" }),
      }),
    enabled: Boolean(refId) && Boolean(configQuery.data),
    retry: false,
  });

  useEffect(() => {
    if (!configQuery.data) return;
    setDraftGranularity(configQuery.data.timeGranularity);
    setDraftEntityType(configQuery.data.entityType);
    setDraftDimensions(configQuery.data.dimensions);
    if (!activeDimensionId && configQuery.data.dimensions[0]) {
      setActiveDimensionId(configQuery.data.dimensions[0].dimensionId);
    }
  }, [configQuery.data, activeDimensionId]);

  const configSnapshot = useMemo(() => {
    if (!configQuery.data) return null;
    return JSON.stringify({
      entityType: configQuery.data.entityType,
      timeGranularity: configQuery.data.timeGranularity,
      dimensions: configQuery.data.dimensions,
    });
  }, [configQuery.data]);

  const draftSnapshot = useMemo(
    () =>
      JSON.stringify({
        entityType: draftEntityType,
        timeGranularity: draftGranularity,
        dimensions: draftDimensions,
      }),
    [draftEntityType, draftGranularity, draftDimensions],
  );

  const isConfigDirty = configSnapshot !== null && draftSnapshot !== configSnapshot;

  const saveMutation = useMutation({
    mutationFn: () =>
      apiFetch<ThemeConfig>("/api/v1/dashboards/theme-analysis", {
        method: "PUT",
        body: JSON.stringify({
          entityType: draftEntityType,
          timeGranularity: draftGranularity,
          refType,
          refId,
          dimensions: draftDimensions,
          chartViewBindings: configQuery.data?.chartViewBindings ?? [],
        }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.themes.config(refType, refId) });
      void qc.invalidateQueries({ queryKey: queryKeys.themes.chartBindings(refType, refId) });
    },
  });

  const canWrite = useMemo(
    () => (user?.roles ?? []).some((r) => ["admin", "analyst", "editor"].includes(r)),
    [user?.roles],
  );

  const toggleDimensionDraft = useCallback((dimensionId: string) => {
    setDraftDimensions((prev) => {
      const exists = prev.some((d) => d.dimensionId === dimensionId);
      if (exists) return prev.filter((d) => d.dimensionId !== dimensionId);
      return [...prev, { dimensionId, label: dimensionId }];
    });
  }, []);

  return {
    canWrite,
    routeDashboardId,
    effectiveDashboardId,
    setSelectedDashboardId,
    dashboardsQuery,
    configQuery,
    chartBindingsQuery,
    executePlanQuery,
    drillQuery,
    geoMapQuery,
    activeDimensionId,
    setActiveDimensionId,
    regionFilter,
    setRegionFilter,
    draftDimensions,
    draftGranularity,
    setDraftGranularity,
    draftEntityType,
    setDraftEntityType,
    toggleDimensionDraft,
    saveMutation,
    isConfigDirty,
    granularities: GRANULARITIES,
  };
}
