import type { ChartRenderPlan } from "@/components/charts/engine/buildChartRenderPlan";
import { renderD3BarRangeChart } from "@/components/charts/engine/d3/cartesian/renderBarRange";
import { renderD3BulletChart } from "@/components/charts/engine/d3/cartesian/renderBullet";
import { renderD3ProgressBarChart } from "@/components/charts/engine/d3/cartesian/renderProgressBar";
import { renderD3StockChart } from "@/components/charts/engine/d3/cartesian/renderStock";
import { renderD3BidirectionalBarChart } from "@/components/charts/engine/d3/cartesian/renderBidirectionalBar";
import { renderD3CartesianChart } from "@/components/charts/engine/d3/cartesian/dispatch";
import { renderD3DualAxesChart } from "@/components/charts/engine/d3/cartesian/renderDualAxes";
import { renderD3WaterfallChart } from "@/components/charts/engine/d3/cartesian/renderWaterfall";
import { renderD3FunnelChart } from "@/components/charts/engine/d3/flow/renderFunnel";
import { renderD3SankeyChart } from "@/components/charts/engine/d3/flow/renderSankey";
import { renderD3ChoroplethChart } from "@/components/charts/engine/d3/geo/renderChoropleth";
import { renderD3ForceGraph } from "@/components/charts/engine/d3/graph/renderForceGraph";
import { renderD3CirclePackingChart } from "@/components/charts/engine/d3/hierarchy/renderCirclePacking";
import { renderD3TreemapChart } from "@/components/charts/engine/d3/hierarchy/renderTreemap";
import { renderD3WordCloudChart } from "@/components/charts/engine/d3/hierarchy/renderWordCloud";
import { renderD3HeatmapChart } from "@/components/charts/engine/d3/matrix/renderHeatmap";
import { renderD3GaugeChart } from "@/components/charts/engine/d3/radial/renderGauge";
import { renderD3LiquidChart } from "@/components/charts/engine/d3/radial/renderLiquid";
import { renderD3PieChart } from "@/components/charts/engine/d3/radial/renderPie";
import { renderD3KpiChart } from "@/components/charts/engine/d3/quota/renderKpi";
import { renderD3RadarChart } from "@/components/charts/engine/d3/radial/renderRadar";
import { renderD3QuadrantChart } from "@/components/charts/engine/d3/relation/renderQuadrant";
import { renderD3ScatterChart } from "@/components/charts/engine/d3/relation/renderScatter";
import type {
  D3BarRangeRenderConfig,
  D3BidirectionalBarRenderConfig,
  D3BulletRenderConfig,
  D3CartesianRenderConfig,
  D3DualAxesRenderConfig,
  D3GeoRenderConfig,
  D3MatrixRenderConfig,
  D3ProgressBarRenderConfig,
  D3RenderConfig,
  D3StockRenderConfig,
  D3WaterfallRenderConfig,
} from "@/components/charts/engine/d3/types";
import { renderD3BarChart } from "@/components/charts/engine/d3/cartesian/renderBar";

export type D3DispatchPayload =
  | { kind: "cartesian"; config: D3CartesianRenderConfig }
  | { kind: "generic"; config: D3RenderConfig }
  | { kind: "geo"; config: D3GeoRenderConfig }
  | { kind: "matrix"; config: D3MatrixRenderConfig }
  | { kind: "dualAxes"; config: D3DualAxesRenderConfig }
  | { kind: "waterfall"; config: D3WaterfallRenderConfig }
  | { kind: "bidirectional"; config: D3BidirectionalBarRenderConfig }
  | { kind: "barRange"; config: D3BarRangeRenderConfig }
  | { kind: "progressBar"; config: D3ProgressBarRenderConfig }
  | { kind: "bullet"; config: D3BulletRenderConfig }
  | { kind: "stock"; config: D3StockRenderConfig };

export function renderD3Chart(
  container: HTMLElement,
  plan: ChartRenderPlan,
  payload: D3DispatchPayload,
): () => void {
  const plotType = plan.plotType;

  if (payload.kind === "geo") return renderD3ChoroplethChart(container, payload.config);
  if (payload.kind === "matrix") return renderD3HeatmapChart(container, payload.config);
  if (payload.kind === "dualAxes") return renderD3DualAxesChart(container, payload.config);
  if (payload.kind === "waterfall") return renderD3WaterfallChart(container, payload.config);
  if (payload.kind === "bidirectional") return renderD3BidirectionalBarChart(container, payload.config);
  if (payload.kind === "barRange") return renderD3BarRangeChart(container, payload.config);
  if (payload.kind === "progressBar") return renderD3ProgressBarChart(container, payload.config);
  if (payload.kind === "bullet") return renderD3BulletChart(container, payload.config);
  if (payload.kind === "stock") return renderD3StockChart(container, payload.config);

  if (payload.kind === "cartesian") {
    if (plotType === "Waterfall") return renderD3WaterfallChart(container, payload.config as unknown as D3WaterfallRenderConfig);
    if (plotType === "BidirectionalBar") {
      return renderD3BidirectionalBarChart(container, payload.config as unknown as D3BidirectionalBarRenderConfig);
    }
    if (plotType === "DualAxes") {
      return renderD3DualAxesChart(container, payload.config as unknown as D3DualAxesRenderConfig);
    }
    return renderD3CartesianChart(container, plan, payload.config);
  }

  const generic = payload.config;
  switch (plotType) {
    case "Pie":
      return renderD3PieChart(container, generic);
    case "Kpi":
      return renderD3KpiChart(container, generic);
    case "Gauge":
      return renderD3GaugeChart(container, generic);
    case "Liquid":
      return renderD3LiquidChart(container, generic);
    case "Radar":
      return renderD3RadarChart(container, generic);
    case "Scatter":
      return renderD3ScatterChart(container, generic);
    case "Quadrant":
      return renderD3QuadrantChart(container, generic);
    case "Funnel":
      return renderD3FunnelChart(container, generic);
    case "Sankey":
      return renderD3SankeyChart(container, generic);
    case "Treemap":
      return renderD3TreemapChart(container, generic);
    case "CirclePacking":
      return renderD3CirclePackingChart(container, generic);
    case "WordCloud":
      return renderD3WordCloudChart(container, generic);
    case "Heatmap":
      return renderD3HeatmapChart(container, generic as unknown as D3MatrixRenderConfig);
    case "ForceGraph":
    case "force":
    case "dagre":
      return renderD3ForceGraph(container, generic);
    case "BarRange":
      return renderD3BarRangeChart(container, generic as unknown as D3BarRangeRenderConfig);
    case "ProgressBar":
      return renderD3ProgressBarChart(container, generic as unknown as D3ProgressBarRenderConfig);
    case "Bullet":
      return renderD3BulletChart(container, generic as unknown as D3BulletRenderConfig);
    case "Stock":
      return renderD3StockChart(container, generic as unknown as D3StockRenderConfig);
    case "Column":
    case "Bar":
      return renderD3BarChart(container, payload.config as unknown as D3CartesianRenderConfig);
    default: {
      container.replaceChildren();
      const msg = document.createElement("div");
      msg.className = "flex h-full items-center justify-center text-theme-sm text-error-600";
      msg.setAttribute("role", "alert");
      msg.textContent = `未支持的图表渲染类型: ${plotType}`;
      container.appendChild(msg);
      return () => {
        container.replaceChildren();
      };
    }
  }
}
