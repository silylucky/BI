const PLOT_TEST_IDS: Record<string, string> = {
  Line: "d3-line-chart",
  Column: "d3-bar-chart",
  Bar: "d3-bar-chart",
  Pie: "d3-pie-chart",
  Gauge: "d3-gauge-chart",
  Liquid: "d3-liquid-chart",
  Radar: "d3-radar-chart",
  Scatter: "d3-scatter-chart",
  Quadrant: "d3-quadrant-chart",
  DualAxes: "d3-dual-axes-chart",
  Funnel: "d3-funnel-chart",
  Sankey: "d3-sankey-chart",
  Heatmap: "d3-heatmap-chart",
  WordCloud: "d3-word-cloud-chart",
  BidirectionalBar: "d3-bidirectional-bar-chart",
  Waterfall: "d3-waterfall-chart",
  BarRange: "d3-bar-range-chart",
  ProgressBar: "d3-progress-bar-chart",
  Bullet: "d3-bullet-chart",
  Stock: "d3-stock-chart",
  Treemap: "d3-treemap-chart",
  CirclePacking: "d3-circle-packing-chart",
  Choropleth: "d3-map-chart",
  Kpi: "d3-kpi-chart",
  ForceGraph: "d3-graph-chart",
  dagre: "d3-graph-chart",
  force: "d3-graph-chart",
};

export function d3ChartTestId(chartType: string, plotType: string): string {
  if (chartType.startsWith("area")) return "d3-area-chart";
  if (chartType === "line" || plotType === "Line") return "d3-line-chart";
  if (chartType === "map" || chartType === "map-3d" || plotType === "Choropleth") {
    return chartType === "map-3d" ? "three-map-chart" : "d3-map-chart";
  }
  if (chartType === "graph" || plotType === "ForceGraph") return "d3-graph-chart";
  if (chartType === "t-heatmap" || plotType === "Heatmap") return "d3-heatmap-chart";
  return PLOT_TEST_IDS[plotType] ?? "d3-chart";
}
