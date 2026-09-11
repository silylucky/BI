import type { ChartLegendItem } from "@/lib/chartLegendItems";
import type { ChartStyleContext, ChartLegendSnapshot, ChartViewModel } from "@/components/charts/engine/types";
import {
  ADVANCED_CHART_ROW_CAP,
  capRows,
  resolveSeriesLegendNames,
} from "@/components/charts/engine/buildDatasetEncoding";

const DEFAULT_COLOR = "#465fff";

/** 从 ViewModel 计算图例项（不依赖 ECharts option） */
export function buildLegendSnapshot(
  vm: ChartViewModel,
  ctx: ChartStyleContext,
): ChartLegendSnapshot {
  const skipTypes = new Set(["map", "heatmap", "gauge", "sankey", "graph"]);
  if (skipTypes.has(vm.chartType)) {
    return { items: [] };
  }

  const colors = ctx.chartColors.length > 0 ? ctx.chartColors : [DEFAULT_COLOR];
  const { rows: capped } = capRows(vm.dataset.rows, ADVANCED_CHART_ROW_CAP);
  const names = resolveSeriesLegendNames(
    {
      chartType: vm.chartType,
      encoding: vm.encoding,
      styleVariant: vm.styleVariant,
    },
    capped,
    vm.dataset.columns,
  );

  let colorIndex = 0;
  const nextColor = () => colors[colorIndex++ % colors.length] ?? DEFAULT_COLOR;
  const items: ChartLegendItem[] = names.map((name) => ({
    name,
    color: nextColor(),
  }));

  return { items };
}
