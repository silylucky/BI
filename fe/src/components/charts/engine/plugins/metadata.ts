import type { EngineCapabilities } from "@/components/charts/engine/capabilities";
import type { ChartPluginDef, DePaletteCategory } from "@/components/charts/engine/plugins/types";

const STATS: EngineCapabilities = {
  legend: true,
  label: true,
  dataZoom: true,
  markLines: true,
  conditional: true,
  styleVariant: false,
};

const PIE: EngineCapabilities = {
  legend: true,
  label: true,
  dataZoom: false,
  markLines: false,
  conditional: true,
  styleVariant: false,
};

const GAUGE: EngineCapabilities = {
  legend: false,
  label: true,
  dataZoom: false,
  markLines: false,
  conditional: false,
  styleVariant: false,
};

const MAP: EngineCapabilities = {
  legend: false,
  label: true,
  dataZoom: false,
  markLines: false,
  conditional: false,
  styleVariant: false,
};

const TABLE: EngineCapabilities = {
  legend: false,
  label: false,
  dataZoom: false,
  markLines: false,
  conditional: false,
  styleVariant: false,
};

const FLOW: EngineCapabilities = {
  legend: true,
  label: false,
  dataZoom: false,
  markLines: false,
  conditional: false,
  styleVariant: false,
};

const KPI: EngineCapabilities = {
  legend: false,
  label: false,
  dataZoom: false,
  markLines: false,
  conditional: false,
  styleVariant: false,
};

/** properties 在 registerBuiltinChartPlugins 时从 chartTypeStyleProfiles 注入（G13） */
function def(
  type: string,
  paletteCategory: DePaletteCategory,
  library: ChartPluginDef["library"],
  renderer: ChartPluginDef["renderer"],
  engineCapabilities: EngineCapabilities,
  extra?: Partial<ChartPluginDef>,
): ChartPluginDef {
  return {
    type,
    library,
    paletteCategory,
    renderer,
    engineCapabilities,
    properties: [],
    ...extra,
  };
}

export const BUILTIN_PLUGIN_DEFS: ChartPluginDef[] = [
  def("gauge", "quota", "d3", "antv", GAUGE),
  def("liquid", "quota", "d3", "antv", GAUGE),
  def("kpi", "quota", "d3", "antv", KPI),

  def("table", "table", "react", "table", TABLE, { deprecated: true, migratesTo: "table-info" }),
  def("table-info", "table", "d3", "antv", TABLE),
  def("table-normal", "table", "d3", "antv", TABLE),
  def("table-pivot", "table", "d3", "antv", TABLE),
  def("t-heatmap", "table", "d3", "antv", TABLE),

  def("line", "trend", "d3", "antv", STATS),
  def("area", "trend", "d3", "antv", STATS),
  def("area-stack", "trend", "d3", "antv", STATS),
  def("timeline", "trend", "d3", "antv", STATS, { deprecated: true, migratesTo: "line" }),

  def("bar", "compare", "d3", "antv", STATS),
  def("bar-stack", "compare", "d3", "antv", STATS),
  def("percentage-bar-stack", "compare", "d3", "antv", STATS),
  def("bar-group", "compare", "d3", "antv", STATS),
  def("bar-group-stack", "compare", "d3", "antv", STATS),
  def("waterfall", "compare", "d3", "antv", FLOW),
  def("bar-horizontal", "compare", "d3", "antv", STATS),
  def("bar-stack-horizontal", "compare", "d3", "antv", STATS),
  def("percentage-bar-stack-horizontal", "compare", "d3", "antv", STATS),
  def("bar-range", "compare", "d3", "antv", STATS),
  def("bidirectional-bar", "compare", "d3", "antv", STATS),
  def("progress-bar", "compare", "d3", "antv", STATS),
  def("stock-line", "compare", "d3", "antv", STATS),
  def("bullet-graph", "compare", "d3", "antv", STATS),

  def("pie", "distribute", "d3", "antv", PIE),
  def("pie-donut", "distribute", "d3", "antv", PIE),
  def("pie-rose", "distribute", "d3", "antv", PIE),
  def("pie-donut-rose", "distribute", "d3", "antv", PIE),
  def("radar", "distribute", "d3", "antv", PIE),
  def("treemap", "distribute", "d3", "antv", PIE),
  def("word-cloud", "distribute", "d3", "antv", PIE),
  def("wordCloud", "distribute", "d3", "antv", PIE, { deprecated: true, migratesTo: "word-cloud" }),

  def("map", "map", "d3", "antv", MAP),
  def("map-3d", "map", "d3", "antv", MAP),
  def("gis-map", "map", "maplibre", "antv", MAP),
  def("heatmap", "map", "d3", "antv", MAP, { deprecated: true, migratesTo: "t-heatmap" }),

  def("scatter", "relation", "d3", "antv", STATS),
  def("quadrant", "relation", "d3", "antv", STATS),
  def("funnel", "relation", "d3", "antv", FLOW),
  def("sankey", "relation", "d3", "antv", FLOW),
  def("circle-packing", "relation", "d3", "antv", PIE),
  def("multi-scatter", "relation", "d3", "antv", STATS),
  def("graph", "relation", "d3", "antv", FLOW),

  def("combo", "dual_axes", "d3", "antv", STATS, { deprecated: true, migratesTo: "chart-mix" }),
  def("chart-mix", "dual_axes", "d3", "antv", STATS),
  def("chart-mix-group", "dual_axes", "d3", "antv", STATS),
  def("chart-mix-stack", "dual_axes", "d3", "antv", STATS),
  def("chart-mix-dual-line", "dual_axes", "d3", "antv", STATS),
];
