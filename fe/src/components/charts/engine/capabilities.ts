import type { ChartEngineId } from "@/components/charts/engine/types";
import type { ChartType } from "@/lib/chartViewConfig";
import { resolveD3WiredCapabilities } from "@/components/charts/engine/d3/inspectorCapabilityMatrix";
import { getEngineIdForChartType } from "@/components/charts/engine/registry";
import { getChartPlugin } from "@/components/charts/engine/plugins/registry";

export type EngineCapabilities = {
  legend: boolean;
  label: boolean;
  dataZoom: boolean;
  markLines: boolean;
  conditional: boolean;
  styleVariant: boolean;
};

const DEFAULT_CAPS: EngineCapabilities = {
  legend: true,
  label: true,
  dataZoom: true,
  markLines: true,
  conditional: true,
  styleVariant: false,
};

const LEGACY_CAPS: Record<string, EngineCapabilities> = {
  table: {
    legend: false,
    label: false,
    dataZoom: false,
    markLines: false,
    conditional: false,
    styleVariant: false,
  },
  kpi: {
    legend: false,
    label: false,
    dataZoom: false,
    markLines: false,
    conditional: false,
    styleVariant: false,
  },
  pie: {
    legend: true,
    label: true,
    dataZoom: false,
    markLines: false,
    conditional: true,
    styleVariant: false,
  },
  gauge: {
    legend: false,
    label: true,
    dataZoom: false,
    markLines: false,
    conditional: false,
    styleVariant: false,
  },
  map: {
    legend: false,
    label: true,
    dataZoom: false,
    markLines: false,
    conditional: false,
    styleVariant: false,
  },
};

function legacyCapsForType(chartType: ChartType | string): EngineCapabilities {
  if (chartType in LEGACY_CAPS) {
    return LEGACY_CAPS[chartType as keyof typeof LEGACY_CAPS];
  }
  if (chartType === "sankey" || chartType === "funnel" || chartType === "waterfall" || chartType === "graph") {
    return {
      legend: chartType !== "graph",
      label: chartType === "graph",
      dataZoom: false,
      markLines: false,
      conditional: false,
      styleVariant: chartType === "graph",
    };
  }
  return DEFAULT_CAPS;
}

export function resolveEngineCapabilities(
  chartType: ChartType | string,
  engineId?: ChartEngineId,
): EngineCapabilities {
  const engine = engineId ?? getEngineIdForChartType(chartType);
  const d3Caps = engine !== "table" ? resolveD3WiredCapabilities(chartType) : null;
  if (d3Caps) return d3Caps;

  const plugin = getChartPlugin(chartType);
  if (plugin) return plugin.engineCapabilities;

  if (engine === "table") return LEGACY_CAPS.table;
  return legacyCapsForType(chartType);
}

export function engineSupports(
  chartType: ChartType | string,
  capability: keyof EngineCapabilities,
  engineId?: ChartEngineId,
): boolean {
  return resolveEngineCapabilities(chartType, engineId)[capability];
}

export function listRegisteredEngines(): ChartEngineId[] {
  return ["d3", "antv", "table"];
}
