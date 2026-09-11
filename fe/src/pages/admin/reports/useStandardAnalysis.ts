import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";

export type AnalysisTheme = "lifecycle" | "activity" | "trend" | "distribution";
export type SnapshotCronPreset = "daily" | "weekly" | "monthly";

export type FieldMapping = {
  status?: string;
  region?: string;
  createdAt?: string;
};

export type AnalysisPack = {
  packKey: string;
  displayName: string;
  businessObjectCode?: string;
  physicalTableFqn?: string;
  datasetId?: string;
  boundConfigId?: string;
  dataSourceId: string;
  fieldMapping: FieldMapping;
  enabledThemes: AnalysisTheme[];
  allowedRoles: string[];
  snapshotCronPreset: SnapshotCronPreset;
  snapshotRetentionPeriods?: number;
};

export type StandardAnalysisRenderMeta = {
  sourceRowCount?: number;
  aggregatedPointCount?: number;
  queryLimit?: number;
  timeStep?: "daily" | "weekly" | "monthly" | null;
  timeStepLabel?: string | null;
  topN?: number | null;
  topNTruncated?: boolean;
  pointCap?: number | null;
  pointCapApplied?: boolean;
  sampleBased?: boolean;
};

export type RunResult = {
  packKey: string;
  theme: AnalysisTheme;
  renderSpec: {
    meta?: StandardAnalysisRenderMeta;
    sections: Array<{
      kind: string;
      columns: Array<{ name: string } | string>;
      rows: unknown[];
      chartType?: string;
    }>;
  };
  dataSourceId: string;
  status: "ready";
};

export type CompareResult = {
  packKey: string;
  theme: AnalysisTheme;
  currentPeriodKey: string;
  previousPeriodKey: string | null;
  currentSource?: "live" | "snapshot";
  current: { columns: unknown[]; rows: unknown[] };
  previous: { columns: unknown[]; rows: unknown[] } | null;
  deltas: Array<{
    key: string;
    currentValue: number;
    previousValue: number | null;
    delta: number | null;
    deltaPct: number | null;
  }>;
};

export type CompareMatrixResult = {
  packKey: string;
  theme: AnalysisTheme;
  periodKind: SnapshotCronPreset;
  periodKeys: string[];
  rows: Array<{ key: string; values: Record<string, number> }>;
};

export type CompareQueryOptions = {
  baselinePeriodKey?: string;
  currentPeriodKey?: string;
};

export type SnapshotRecord = {
  id: string;
  packKey: string;
  theme: AnalysisTheme;
  periodKind: SnapshotCronPreset;
  periodKey: string;
  capturedAt: string;
};

export type ThemeCapability = {
  theme: AnalysisTheme;
  available: boolean;
  reason?: string | null;
};

export type CapabilitiesResult = {
  packKey: string;
  themes: ThemeCapability[];
  columns: string[];
};

const THEME_PRIORITY: AnalysisTheme[] = ["trend", "activity", "distribution", "lifecycle"];

export function themePriorityOrder(themes: AnalysisTheme[]): AnalysisTheme[] {
  const prioritized = THEME_PRIORITY.filter((theme) => themes.includes(theme));
  const remainder = themes.filter((theme) => !THEME_PRIORITY.includes(theme));
  return [...prioritized, ...remainder];
}

export function resolveFirstAvailableTheme(
  pack: AnalysisPack | null | undefined,
  capabilities: ThemeCapability[] | undefined,
): AnalysisTheme | null {
  if (!pack) return null;
  const capMap = new Map(capabilities?.map((item) => [item.theme, item]) ?? []);
  for (const theme of themePriorityOrder(pack.enabledThemes)) {
    const cap = capMap.get(theme);
    if (!cap || cap.available) return theme;
  }
  return pack.enabledThemes[0] ?? null;
}

export function isThemeAvailable(
  theme: AnalysisTheme,
  capabilities: ThemeCapability[] | undefined,
): boolean {
  const cap = capabilities?.find((item) => item.theme === theme);
  return cap?.available ?? true;
}

export function themeCapabilityReason(
  theme: AnalysisTheme,
  capabilities: ThemeCapability[] | undefined,
): string | undefined {
  const cap = capabilities?.find((item) => item.theme === theme);
  if (!cap || cap.available) return undefined;
  return cap.reason ?? "当前主题不可用";
}

export function useStandardCapabilities(packKey: string | null) {
  return useQuery({
    queryKey: queryKeys.reports.standardCapabilities(packKey ?? ""),
    queryFn: () =>
      apiFetch<CapabilitiesResult>(`/api/v1/reports/standard/packs/${packKey}/capabilities`),
    enabled: Boolean(packKey),
  });
}

export function useStandardPacks() {
  return useQuery({
    queryKey: queryKeys.reports.standardPacks,
    queryFn: () => apiFetch<{ items: AnalysisPack[]; total: number }>("/api/v1/reports/standard/packs"),
  });
}

export function useStandardRun(packKey: string | null, theme: AnalysisTheme | null) {
  return useQuery({
    queryKey: queryKeys.reports.standardRun(packKey ?? "", theme ?? ""),
    queryFn: () =>
      apiFetch<RunResult>(`/api/v1/reports/standard/packs/${packKey}/run`, {
        method: "POST",
        body: JSON.stringify({ theme }),
      }),
    enabled: Boolean(packKey && theme),
  });
}

export function useStandardCompare(
  packKey: string | null,
  theme: AnalysisTheme | null,
  options?: CompareQueryOptions,
) {
  const baselinePeriodKey = options?.baselinePeriodKey;
  const currentPeriodKey = options?.currentPeriodKey;
  return useQuery({
    queryKey: queryKeys.reports.standardCompare(
      packKey ?? "",
      theme ?? "",
      baselinePeriodKey,
      currentPeriodKey,
    ),
    queryFn: () => {
      const params = new URLSearchParams({ theme: theme ?? "" });
      if (baselinePeriodKey) params.set("baseline_period_key", baselinePeriodKey);
      if (currentPeriodKey) params.set("current_period_key", currentPeriodKey);
      return apiFetch<CompareResult>(
        `/api/v1/reports/standard/packs/${packKey}/compare?${params.toString()}`,
      );
    },
    enabled: Boolean(packKey && theme),
  });
}

export function useStandardCompareMatrix(
  packKey: string | null,
  theme: AnalysisTheme | null,
  periodKeys: string[],
) {
  const sortedKeys = [...periodKeys].sort().join(",");
  return useQuery({
    queryKey: queryKeys.reports.standardCompareMatrix(packKey ?? "", theme ?? "", sortedKeys),
    queryFn: () => {
      const params = new URLSearchParams({
        theme: theme ?? "",
        period_keys: periodKeys.join(","),
      });
      return apiFetch<CompareMatrixResult>(
        `/api/v1/reports/standard/packs/${packKey}/compare/matrix?${params.toString()}`,
      );
    },
    enabled: Boolean(packKey && theme && periodKeys.length >= 2),
  });
}

export function useStandardSnapshots(packKey: string | null, theme: AnalysisTheme | null) {
  return useQuery({
    queryKey: queryKeys.reports.standardSnapshots(packKey ?? "", theme ?? undefined),
    queryFn: () => {
      const params = new URLSearchParams();
      if (theme) params.set("theme", theme);
      const suffix = params.toString() ? `?${params.toString()}` : "";
      return apiFetch<{ items: SnapshotRecord[]; total: number }>(
        `/api/v1/reports/standard/packs/${packKey}/snapshots${suffix}`,
      );
    },
    enabled: Boolean(packKey),
  });
}

export function useCaptureStandardSnapshot() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      packKey,
      theme,
      periodKey,
    }: {
      packKey: string;
      theme: AnalysisTheme;
      periodKey?: string;
    }) => {
      const params = new URLSearchParams({ theme });
      if (periodKey) params.set("period_key", periodKey);
      return apiFetch<SnapshotRecord>(
        `/api/v1/reports/standard/packs/${packKey}/snapshots/capture?${params.toString()}`,
        { method: "POST" },
      );
    },
    onSuccess: (data, { packKey, theme }) => {
      qc.invalidateQueries({ queryKey: queryKeys.reports.standardSnapshots(packKey) });
      qc.invalidateQueries({ queryKey: queryKeys.reports.standardSnapshots(packKey, theme) });
      qc.invalidateQueries({ queryKey: ["reports", "standardCompare", packKey, theme] });
      qc.invalidateQueries({ queryKey: ["reports", "standardCompareMatrix", packKey, theme] });
      return data;
    },
  });
}

export function useStandardPackMutations() {
  const qc = useQueryClient();

  const upsert = useMutation({
    mutationFn: ({ packKey, body }: { packKey: string; body: AnalysisPack }) =>
      apiFetch<AnalysisPack>(`/api/v1/reports/standard/packs/${packKey}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: (saved) => {
      qc.setQueryData<{ items: AnalysisPack[]; total: number }>(
        queryKeys.reports.standardPacks,
        (prev) => {
          const items = prev?.items ?? [];
          const index = items.findIndex((pack) => pack.packKey === saved.packKey);
          const nextItems =
            index >= 0 ? items.map((pack, i) => (i === index ? saved : pack)) : [...items, saved];
          return { items: nextItems, total: nextItems.length };
        },
      );
    },
  });

  const remove = useMutation({
    mutationFn: (packKey: string) =>
      apiFetch<void>(`/api/v1/reports/standard/packs/${packKey}`, { method: "DELETE" }),
    onSuccess: (_data, packKey) => {
      qc.setQueryData<{ items: AnalysisPack[]; total: number }>(
        queryKeys.reports.standardPacks,
        (prev) => {
          if (!prev) return prev;
          const items = prev.items.filter((pack) => pack.packKey !== packKey);
          return { items, total: items.length };
        },
      );
    },
  });

  return { upsert, remove };
}
