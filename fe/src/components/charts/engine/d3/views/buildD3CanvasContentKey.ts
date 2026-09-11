import type { ChartRenderPlan } from "@/components/charts/engine/buildChartRenderPlan";
import type { ChartStyleContext } from "@/components/charts/engine/types";
import type { ChartViewConfig } from "@/lib/chartViewConfig";
import { chartDeStyleRenderFingerprint } from "@/lib/chartDeStyle";

type GraphNodeInput = { id: string; data?: { label?: string } };
type GraphEdgeInput = { source: string; target: string };

function graphPlanSignature(plan: ChartRenderPlan): string {
  if (plan.plotType !== "ForceGraph" && plan.plotType !== "force" && plan.plotType !== "dagre") {
    return "";
  }
  const options = plan.options ?? {};
  const nodes = (options.nodes as GraphNodeInput[] | undefined) ?? [];
  const edges = (options.edges as GraphEdgeInput[] | undefined) ?? [];
  const nodeSig = nodes.map((node) => node.id).sort().join(",");
  const edgeSig = edges
    .map((edge) => `${edge.source}->${edge.target}`)
    .sort()
    .join(",");
  return [
    options.__graphLayout ?? "",
    options.__graphEdgeLength ?? "",
    options.__graphRepulsion ?? "",
    nodeSig,
    edgeSig,
  ].join("§");
}

/** 数据/样式变更才重建 D3 画布，避免父组件重渲染重启力导向模拟 */
export function buildD3CanvasContentKey(input: {
  chartType: string;
  plotType: string;
  plan: ChartRenderPlan;
  rowCount: number;
  rowSample?: string;
  style: ChartStyleContext;
  chartConfig?: ChartViewConfig;
  chartDataRevision?: string;
}): string {
  const { style } = input;
  return [
    input.chartDataRevision ?? "",
    input.chartType,
    input.plotType,
    input.plan.error ?? "",
    input.plan.empty ? 1 : 0,
    input.rowCount,
    input.rowSample ?? "",
    style.depthVisual ?? "off",
    style.showLabel ? 1 : 0,
    style.showTooltip ? 1 : 0,
    style.seriesGradient ? 1 : 0,
    style.dataZoom ? 1 : 0,
    style.scheme,
    style.chartColors.join(","),
    style.effectivePaletteId ?? "",
    style.paletteOpacity ?? "",
    chartDeStyleRenderFingerprint(style.deStyle),
    style.labelPresentation.fontSize,
    style.labelPresentation.color ?? "",
    JSON.stringify(style.labelContent),
    JSON.stringify(style.deFeatures ?? {}),
    graphPlanSignature(input.plan),
  ].join("|");
}
