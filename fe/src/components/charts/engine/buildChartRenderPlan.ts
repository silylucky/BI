import type { ChartViewModel } from "@/components/charts/engine/types";
import "@/components/charts/engine/plugins/index";
import { buildPlanForType } from "@/components/charts/engine/plugins/plans/buildPlan";
import { getChartPlugin } from "@/components/charts/engine/plugins/registry";

export type ChartPlotKind = "d3";

export type ChartRenderPlan = {
  kind: ChartPlotKind;
  plotType: string;
  options: Record<string, unknown>;
  empty?: boolean;
  error?: string;
};

export function buildChartRenderPlan(vm: ChartViewModel): ChartRenderPlan {
  const plugin = getChartPlugin(vm.chartType);
  if (plugin) {
    return plugin.buildRenderPlan(vm);
  }
  return buildPlanForType(vm.chartType, vm);
}
