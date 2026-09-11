import type { EngineCapabilities } from "@/components/charts/engine/capabilities";
import { getChartPlugin } from "@/components/charts/engine/plugins/registry";

/** Inspector 高级/样式能力在 D3 renderer 中的接线状态（轨 A/B 真理源） */
export type D3FeatureWiring = "wired" | "partial" | "missing";

export type D3InspectorFeatureMatrix = {
  legend: D3FeatureWiring;
  label: D3FeatureWiring;
  dataZoom: D3FeatureWiring;
  markLines: D3FeatureWiring;
  conditional: D3FeatureWiring;
};

const WIRED: D3InspectorFeatureMatrix = {
  legend: "wired",
  label: "wired",
  dataZoom: "wired",
  markLines: "wired",
  conditional: "wired",
};

const PARTIAL_LEGEND: D3InspectorFeatureMatrix = {
  ...WIRED,
  legend: "partial",
};

/** 按 chartType 登记 D3 实测接线；未登记则继承 plugin.engineCapabilities */
const D3_WIRING_BY_TYPE: Record<string, D3InspectorFeatureMatrix> = {
  line: WIRED,
  area: WIRED,
  "area-stack": WIRED,
  bar: WIRED,
  "bar-stack": WIRED,
  "percentage-bar-stack": WIRED,
  "bar-group": WIRED,
  "bar-group-stack": WIRED,
  "bar-horizontal": WIRED,
  "bar-stack-horizontal": WIRED,
  "percentage-bar-stack-horizontal": WIRED,
  "chart-mix": WIRED,
  "chart-mix-group": WIRED,
  "chart-mix-stack": WIRED,
  "chart-mix-dual-line": { ...WIRED, conditional: "wired" },
  scatter: WIRED,
  quadrant: WIRED,
  "multi-scatter": WIRED,
  pie: { legend: "wired", label: "wired", dataZoom: "missing", markLines: "missing", conditional: "wired" },
  "pie-donut": { legend: "wired", label: "wired", dataZoom: "missing", markLines: "missing", conditional: "wired" },
  "pie-rose": { legend: "wired", label: "wired", dataZoom: "missing", markLines: "missing", conditional: "wired" },
  "pie-donut-rose": { legend: "wired", label: "wired", dataZoom: "missing", markLines: "missing", conditional: "wired" },
  radar: { legend: "missing", label: "wired", dataZoom: "missing", markLines: "missing", conditional: "wired" },
  treemap: { legend: "missing", label: "wired", dataZoom: "missing", markLines: "missing", conditional: "wired" },
  "word-cloud": { legend: "missing", label: "missing", dataZoom: "missing", markLines: "missing", conditional: "missing" },
  wordCloud: { legend: "missing", label: "missing", dataZoom: "missing", markLines: "missing", conditional: "missing" },
  map: { legend: "missing", label: "wired", dataZoom: "missing", markLines: "missing", conditional: "missing" },
  "map-3d": { legend: "missing", label: "missing", dataZoom: "missing", markLines: "missing", conditional: "missing" },
  gauge: { legend: "missing", label: "wired", dataZoom: "missing", markLines: "missing", conditional: "missing" },
  liquid: { legend: "missing", label: "wired", dataZoom: "missing", markLines: "missing", conditional: "missing" },
  waterfall: { legend: "wired", label: "wired", dataZoom: "missing", markLines: "missing", conditional: "wired" },
  "bar-range": { legend: "missing", label: "wired", dataZoom: "missing", markLines: "missing", conditional: "wired" },
  "bidirectional-bar": { legend: "wired", label: "wired", dataZoom: "missing", markLines: "missing", conditional: "wired" },
  "progress-bar": { legend: "missing", label: "wired", dataZoom: "missing", markLines: "missing", conditional: "wired" },
  "stock-line": { legend: "missing", label: "wired", dataZoom: "missing", markLines: "missing", conditional: "wired" },
  "bullet-graph": { legend: "missing", label: "wired", dataZoom: "missing", markLines: "missing", conditional: "wired" },
  funnel: { legend: "wired", label: "wired", dataZoom: "missing", markLines: "missing", conditional: "wired" },
  sankey: { legend: "missing", label: "wired", dataZoom: "missing", markLines: "missing", conditional: "missing" },
  "circle-packing": { legend: "missing", label: "wired", dataZoom: "missing", markLines: "missing", conditional: "wired" },
  graph: { legend: "missing", label: "wired", dataZoom: "missing", markLines: "missing", conditional: "missing" },
};

function wiringToCaps(matrix: D3InspectorFeatureMatrix): EngineCapabilities {
  return {
    legend: matrix.legend !== "missing",
    label: matrix.label !== "missing",
    dataZoom: matrix.dataZoom !== "missing",
    markLines: matrix.markLines !== "missing",
    conditional: matrix.conditional !== "missing",
    styleVariant: false,
  };
}

export function resolveD3InspectorFeatureMatrix(chartType: string): D3InspectorFeatureMatrix | null {
  return D3_WIRING_BY_TYPE[chartType] ?? null;
}

export type D3InspectorFeatureKey = keyof D3InspectorFeatureMatrix;

export function readD3FeatureWiring(
  chartType: string,
  feature: D3InspectorFeatureKey,
): D3FeatureWiring | null {
  const matrix = D3_WIRING_BY_TYPE[chartType];
  return matrix?.[feature] ?? null;
}

export function isD3FeaturePartial(chartType: string, feature: D3InspectorFeatureKey): boolean {
  return readD3FeatureWiring(chartType, feature) === "partial";
}

/** 将 D3 实测矩阵转为 Inspector 应展示的能力（轨 B：missing 不展示） */
export function resolveD3WiredCapabilities(chartType: string): EngineCapabilities | null {
  const matrix = D3_WIRING_BY_TYPE[chartType];
  if (!matrix) return null;
  const caps = wiringToCaps(matrix);
  const plugin = getChartPlugin(chartType);
  if (plugin) {
    return { ...caps, styleVariant: plugin.engineCapabilities.styleVariant };
  }
  return caps;
}

export function listD3WiringChartTypes(): string[] {
  return Object.keys(D3_WIRING_BY_TYPE);
}
