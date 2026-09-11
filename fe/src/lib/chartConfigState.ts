import type { ChartFieldRef, ChartViewConfig } from "@/lib/chartViewConfig";
import { isD3TableChartType } from "@/components/charts/engine/registry";
import { isGisMapChartType, isLegacyTableChartType } from "@/lib/chartViewConfig";
import { isChartExecuteReady } from "@/lib/chartExecuteProbe";
import { deAxisRenderReady, syncLegacyFieldsFromAxes } from "@/lib/resolveChartEncoding";

export type ChartConfigPhase = {
  bindingReady: boolean;
  queryReady: boolean;
  renderReady: boolean;
};

export function activeFieldRefs(refs: ChartFieldRef[] | undefined): ChartFieldRef[] {
  return (refs ?? []).filter((r) => Boolean(r.field?.trim()));
}

export function normalizeChartFieldRefs(refs: ChartFieldRef[] | undefined): ChartFieldRef[] {
  return activeFieldRefs(refs);
}

export function resolveChartConfigPhase(config: ChartViewConfig | undefined): ChartConfigPhase {
  const chartType = config?.chartType ?? "table";
  if (config && isGisMapChartType(chartType)) {
    const queryReady = isChartExecuteReady(config);
    return {
      bindingReady: true,
      queryReady,
      renderReady: true,
    };
  }

  const queryReady = config ? isChartExecuteReady(config) : false;
  const dimFields = activeFieldRefs(config?.dimensions);
  const metricFields = activeFieldRefs(config?.metrics);

  let renderReady = false;
  if (queryReady && config) {
    if (isLegacyTableChartType(chartType)) {
      renderReady = dimFields.length > 0 || metricFields.length > 0;
    } else if (isD3TableChartType(chartType)) {
      renderReady = deAxisRenderReady(config) || dimFields.length > 0 || metricFields.length > 0;
    } else {
      renderReady = deAxisRenderReady(config);
    }
  }

  return {
    bindingReady: queryReady,
    queryReady,
    renderReady,
  };
}

export function isWidgetConfigReady(chartConfig: ChartViewConfig | undefined): boolean {
  if (!chartConfig) return false;
  if (isGisMapChartType(chartConfig.chartType)) return true;
  return isChartExecuteReady(chartConfig);
}

function reconcileAxisFields(
  axes: ChartViewConfig["axes"],
  colSet: Set<string>,
): ChartViewConfig["axes"] {
  if (!axes) return axes;
  const next: NonNullable<ChartViewConfig["axes"]> = {};
  for (const [axisId, refs] of Object.entries(axes)) {
    next[axisId as keyof typeof next] = (refs ?? []).map((r) =>
      r.field?.trim() && colSet.has(r.field) ? r : { field: "" },
    );
  }
  return next;
}

function reconcileTimeRangeField(
  timeRange: ChartViewConfig["timeRange"],
  colSet: Set<string>,
): ChartViewConfig["timeRange"] {
  const field = timeRange?.field?.trim();
  if (!timeRange?.enabled || !field) return timeRange;
  if (colSet.has(field)) return timeRange;
  return { ...timeRange, field: undefined };
}

export function reconcileChartFields(
  config: ChartViewConfig,
  availableColumns: string[],
): ChartViewConfig {
  const colSet = new Set(availableColumns);
  const reconcile = (refs: ChartFieldRef[] | undefined) =>
    (refs ?? []).map((r) => (r.field?.trim() && colSet.has(r.field) ? r : { field: "" }));
  const axes = reconcileAxisFields(config.axes, colSet);
  const withAxes = {
    ...config,
    dimensions: reconcile(config.dimensions),
    metrics: reconcile(config.metrics),
    axes,
    timeRange: reconcileTimeRangeField(config.timeRange, colSet),
  };
  return syncLegacyFieldsFromAxes(withAxes);
}

