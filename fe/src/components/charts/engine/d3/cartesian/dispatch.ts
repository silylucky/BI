import { renderD3AreaChart } from "@/components/charts/engine/d3/cartesian/renderArea";
import { renderD3BarChart } from "@/components/charts/engine/d3/cartesian/renderBar";
import { renderD3LineChart } from "@/components/charts/engine/d3/renderD3LineChart";
import type { ChartRenderPlan } from "@/components/charts/engine/buildChartRenderPlan";
import type { D3CartesianRenderConfig } from "@/components/charts/engine/d3/types";

export function renderD3CartesianChart(
  container: HTMLElement,
  plan: ChartRenderPlan,
  config: D3CartesianRenderConfig,
): () => void {
  const plotType = plan.plotType;
  const opts = plan.options;

  if (plotType === "Column" || plotType === "Bar") {
    return renderD3BarChart(container, config);
  }
  if (opts.isStack && opts.area) {
    return renderD3AreaChart(container, config);
  }
  if (opts.area) {
    return renderD3LineChart(container, config);
  }
  return renderD3LineChart(container, config);
}
