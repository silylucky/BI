import type { ChartViewConfig } from "@/lib/chartViewConfig";
import { buildChartViewModel } from "@/components/charts/engine/buildChartViewModel";
import { BUILTIN_PLUGIN_DEFS } from "@/components/charts/engine/plugins/metadata";
import type { ChartViewModel } from "@/components/charts/engine/types";

const SMOKE_DS = "00000000-0000-4000-8000-000000000001";

/** §2 标准夹具列（日销售） */
const F1_COLUMNS = ["sale_date", "region", "amount", "amount2"] as const;
const F1_ROWS: unknown[][] = [
  ["2025-07-01", "华东", 100, 80],
  ["2025-07-02", "华北", 200, 120],
  ["2025-07-03", "华南", 150, 90],
];

const F1_DIM = [{ field: "sale_date" }];
const F1_DIM_SUB = [{ field: "sale_date" }, { field: "region" }];
const F1_MET = [{ field: "amount" }];
const F1_DUAL_MET = [{ field: "amount" }, { field: "amount2" }];

/** §2 F2 地区占比 */
const F2_COLUMNS = ["region", "amount"] as const;
const F2_ROWS: unknown[][] = [
  ["华东", 40],
  ["华北", 35],
  ["华南", 25],
];
const F2_DIM = [{ field: "region" }];
const F2_MET = [{ field: "amount" }];

export type ChartCatalogSmokeCase = {
  type: ChartViewConfig["chartType"];
  testId: string;
  columns: string[];
  rows: unknown[][];
  dimensions: ChartViewConfig["dimensions"];
  metrics: ChartViewConfig["metrics"];
};

/** catalog 非 deprecated 类型 → L1 可渲染 smoke（对标 docs/automate/plans/2026-07-21-chart-per-type-verification.md §4） */
export const CHART_CATALOG_SMOKE_CASES: ChartCatalogSmokeCase[] = [
  // quota
  {
    type: "gauge",
    testId: "d3-gauge-chart",
    columns: ["value"],
    rows: [[86.5]],
    dimensions: [],
    metrics: [{ field: "value" }],
  },
  {
    type: "liquid",
    testId: "d3-liquid-chart",
    columns: ["value"],
    rows: [[0.72]],
    dimensions: [],
    metrics: [{ field: "value" }],
  },
  {
    type: "kpi",
    testId: "d3-kpi-chart",
    columns: ["revenue", "rate"],
    rows: [[1280, 12.5]],
    dimensions: [],
    metrics: [{ field: "revenue" }],
  },

  // table
  {
    type: "table-info",
    testId: "d3-table-chart",
    columns: ["id", "name"],
    rows: [
      [1, "Alpha"],
      [2, "Beta"],
    ],
    dimensions: [{ field: "id" }, { field: "name" }],
    metrics: [],
  },
  {
    type: "table-normal",
    testId: "d3-table-chart",
    columns: ["region", "amount"],
    rows: F1_ROWS.map((r) => [r[1], r[2]]),
    dimensions: [{ field: "region" }],
    metrics: [{ field: "amount" }],
  },
  {
    type: "table-pivot",
    testId: "d3-table-chart",
    columns: ["row_dim", "col_dim", "amount"],
    rows: [
      ["A", "X", 10],
      ["A", "Y", 20],
    ],
    dimensions: [{ field: "row_dim" }, { field: "col_dim" }],
    metrics: [{ field: "amount" }],
  },
  {
    type: "t-heatmap",
    testId: "d3-heatmap-chart",
    columns: ["x_dim", "y_dim", "value"],
    rows: [
      ["Mon", "AM", 10],
      ["Mon", "PM", 20],
    ],
    dimensions: [{ field: "x_dim" }, { field: "y_dim" }],
    metrics: [{ field: "value" }],
  },

  // trend
  {
    type: "line",
    testId: "d3-line-chart",
    columns: [...F1_COLUMNS],
    rows: F1_ROWS,
    dimensions: F1_DIM,
    metrics: F1_MET,
  },
  {
    type: "area",
    testId: "d3-area-chart",
    columns: [...F1_COLUMNS],
    rows: F1_ROWS,
    dimensions: F1_DIM,
    metrics: F1_MET,
  },
  {
    type: "area-stack",
    testId: "d3-area-chart",
    columns: [...F1_COLUMNS],
    rows: F1_ROWS,
    dimensions: F1_DIM_SUB,
    metrics: F1_MET,
  },

  // compare
  {
    type: "bar",
    testId: "d3-bar-chart",
    columns: [...F1_COLUMNS],
    rows: F1_ROWS,
    dimensions: F1_DIM,
    metrics: F1_MET,
  },
  {
    type: "bar-stack",
    testId: "d3-bar-chart",
    columns: [...F1_COLUMNS],
    rows: F1_ROWS,
    dimensions: F1_DIM_SUB,
    metrics: F1_MET,
  },
  {
    type: "percentage-bar-stack",
    testId: "d3-bar-chart",
    columns: [...F1_COLUMNS],
    rows: F1_ROWS,
    dimensions: F1_DIM_SUB,
    metrics: F1_MET,
  },
  {
    type: "bar-group",
    testId: "d3-bar-chart",
    columns: [...F1_COLUMNS],
    rows: F1_ROWS,
    dimensions: F1_DIM_SUB,
    metrics: F1_MET,
  },
  {
    type: "bar-group-stack",
    testId: "d3-bar-chart",
    columns: [...F1_COLUMNS],
    rows: F1_ROWS,
    dimensions: F1_DIM_SUB,
    metrics: F1_MET,
  },
  {
    type: "waterfall",
    testId: "d3-waterfall-chart",
    columns: ["stage", "value"],
    rows: [
      ["Start", 100],
      ["Delta", 20],
    ],
    dimensions: [{ field: "stage" }],
    metrics: [{ field: "value" }],
  },
  {
    type: "bar-horizontal",
    testId: "d3-bar-chart",
    columns: [...F1_COLUMNS],
    rows: F1_ROWS,
    dimensions: F1_DIM,
    metrics: F1_MET,
  },
  {
    type: "bar-stack-horizontal",
    testId: "d3-bar-chart",
    columns: [...F1_COLUMNS],
    rows: F1_ROWS,
    dimensions: F1_DIM_SUB,
    metrics: F1_MET,
  },
  {
    type: "percentage-bar-stack-horizontal",
    testId: "d3-bar-chart",
    columns: [...F1_COLUMNS],
    rows: F1_ROWS,
    dimensions: F1_DIM_SUB,
    metrics: F1_MET,
  },
  {
    type: "bar-range",
    testId: "d3-bar-range-chart",
    columns: ["cat", "low", "high"],
    rows: [["A", 10, 30]],
    dimensions: [{ field: "cat" }],
    metrics: [{ field: "low" }, { field: "high" }],
  },
  {
    type: "bidirectional-bar",
    testId: "d3-bidirectional-bar-chart",
    columns: ["cat", "left", "right"],
    rows: [
      ["A", 40, 30],
      ["B", 25, 35],
    ],
    dimensions: [{ field: "cat" }],
    metrics: [{ field: "left" }, { field: "right" }],
  },
  {
    type: "progress-bar",
    testId: "d3-progress-bar-chart",
    columns: ["cat", "target", "current"],
    rows: [["A", 100, 50]],
    dimensions: [{ field: "cat" }],
    metrics: [{ field: "target" }, { field: "current" }],
  },
  {
    type: "stock-line",
    testId: "d3-stock-chart",
    columns: ["date", "open", "close", "low", "high"],
    rows: [["2025-01-02", 10, 12, 8, 14]],
    dimensions: [{ field: "date" }],
    metrics: [
      { field: "open" },
      { field: "close" },
      { field: "low" },
      { field: "high" },
    ],
  },
  {
    type: "bullet-graph",
    testId: "d3-bullet-chart",
    columns: ["category", "actual", "target"],
    rows: [["KPI-1", 80, 100]],
    dimensions: [{ field: "category" }],
    metrics: [{ field: "actual" }, { field: "target" }],
  },

  // distribute
  {
    type: "pie",
    testId: "d3-pie-chart",
    columns: [...F2_COLUMNS],
    rows: F2_ROWS,
    dimensions: F2_DIM,
    metrics: F2_MET,
  },
  {
    type: "pie-donut",
    testId: "d3-pie-chart",
    columns: [...F2_COLUMNS],
    rows: F2_ROWS,
    dimensions: F2_DIM,
    metrics: F2_MET,
  },
  {
    type: "pie-rose",
    testId: "d3-pie-chart",
    columns: [...F2_COLUMNS],
    rows: F2_ROWS,
    dimensions: F2_DIM,
    metrics: F2_MET,
  },
  {
    type: "pie-donut-rose",
    testId: "d3-pie-chart",
    columns: [...F2_COLUMNS],
    rows: F2_ROWS,
    dimensions: F2_DIM,
    metrics: F2_MET,
  },
  {
    type: "radar",
    testId: "d3-radar-chart",
    columns: [...F2_COLUMNS],
    rows: F2_ROWS,
    dimensions: F2_DIM,
    metrics: F2_MET,
  },
  {
    type: "treemap",
    testId: "d3-treemap-chart",
    columns: [...F2_COLUMNS],
    rows: F2_ROWS,
    dimensions: F2_DIM,
    metrics: F2_MET,
  },
  {
    type: "word-cloud",
    testId: "d3-word-cloud-chart",
    columns: [...F2_COLUMNS],
    rows: F2_ROWS,
    dimensions: F2_DIM,
    metrics: F2_MET,
  },

  // map
  {
    type: "map",
    testId: "d3-map-chart",
    columns: ["province", "value"],
    rows: [
      ["广东省", 320],
      ["浙江省", 280],
    ],
    dimensions: [{ field: "province" }],
    metrics: [{ field: "value" }],
  },
  {
    type: "map-3d",
    testId: "three-map-chart",
    columns: ["province", "value"],
    rows: [
      ["广东省", 320],
      ["浙江省", 280],
    ],
    dimensions: [{ field: "province" }],
    metrics: [{ field: "value" }],
  },

  // relation
  {
    type: "scatter",
    testId: "d3-scatter-chart",
    columns: ["category", "value"],
    rows: [
      ["A", 20],
      ["B", 25],
    ],
    dimensions: [{ field: "category" }],
    metrics: [{ field: "value" }],
  },
  {
    type: "quadrant",
    testId: "d3-quadrant-chart",
    columns: ["series", "x", "y"],
    rows: [
      ["A", 10, 20],
      ["B", 30, 40],
    ],
    dimensions: [{ field: "series" }],
    metrics: [{ field: "x" }, { field: "y" }],
  },
  {
    type: "multi-scatter",
    testId: "d3-scatter-chart",
    columns: ["color", "x", "y"],
    rows: [
      ["红", 10, 20],
      ["蓝", 15, 25],
    ],
    dimensions: [{ field: "color" }],
    metrics: [{ field: "y" }, { field: "x" }],
  },
  {
    type: "funnel",
    testId: "d3-funnel-chart",
    columns: ["stage", "cnt"],
    rows: [
      ["访问", 100],
      ["注册", 60],
      ["付费", 20],
    ],
    dimensions: [{ field: "stage" }],
    metrics: [{ field: "cnt" }],
  },
  {
    type: "sankey",
    testId: "d3-sankey-chart",
    columns: ["source", "target", "weight"],
    rows: [
      ["访问", "注册", 100],
      ["注册", "付费", 40],
    ],
    dimensions: [{ field: "source" }, { field: "target" }],
    metrics: [{ field: "weight" }],
  },
  {
    type: "circle-packing",
    testId: "d3-circle-packing-chart",
    columns: [...F2_COLUMNS],
    rows: F2_ROWS,
    dimensions: F2_DIM,
    metrics: F2_MET,
  },
  {
    type: "graph",
    testId: "d3-graph-chart",
    columns: ["source", "target"],
    rows: [
      ["A", "B"],
      ["B", "C"],
    ],
    dimensions: [{ field: "source" }, { field: "target" }],
    metrics: [],
  },

  // dual_axes
  {
    type: "chart-mix",
    testId: "d3-dual-axes-chart",
    columns: [...F1_COLUMNS],
    rows: F1_ROWS,
    dimensions: F1_DIM,
    metrics: F1_DUAL_MET,
  },
  {
    type: "chart-mix-group",
    testId: "d3-dual-axes-chart",
    columns: [...F1_COLUMNS],
    rows: F1_ROWS,
    dimensions: F1_DIM_SUB,
    metrics: F1_DUAL_MET,
  },
  {
    type: "chart-mix-stack",
    testId: "d3-dual-axes-chart",
    columns: [...F1_COLUMNS],
    rows: F1_ROWS,
    dimensions: F1_DIM_SUB,
    metrics: F1_DUAL_MET,
  },
  {
    type: "chart-mix-dual-line",
    testId: "d3-dual-axes-chart",
    columns: [...F1_COLUMNS],
    rows: F1_ROWS,
    dimensions: F1_DIM,
    metrics: F1_DUAL_MET,
  },
];

const ACTIVE_TYPES = new Set(
  BUILTIN_PLUGIN_DEFS.filter((def) => !def.deprecated).map((def) => def.type),
);

const SMOKE_DATASET_ID = "demo-sales-wide";
const SMOKE_CONFIG_ID = "d769b018-4fc9-46ea-a055-45c67ec6a318";

export function smokeCaseToConfig(item: ChartCatalogSmokeCase): ChartViewConfig {
  return {
    chartType: item.type,
    dataSourceId: SMOKE_DS,
    mode: "dataset",
    datasetId: SMOKE_DATASET_ID,
    configId: SMOKE_CONFIG_ID,
    dimensions: item.dimensions,
    metrics: item.metrics,
  };
}

export function smokeCaseToViewModel(item: ChartCatalogSmokeCase): ChartViewModel {
  return buildChartViewModel(smokeCaseToConfig(item), {
    columns: item.columns,
    rows: item.rows,
  });
}

/** 与 metadata 非 deprecated 类型一一对应 */
export function assertCatalogSmokeCoverage(): void {
  const covered = new Set(CHART_CATALOG_SMOKE_CASES.map((c) => c.type));
  const missing = [...ACTIVE_TYPES].filter((t) => !covered.has(t as ChartViewConfig["chartType"]));
  const extra = CHART_CATALOG_SMOKE_CASES.filter((c) => !ACTIVE_TYPES.has(c.type));
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `catalog smoke mismatch: missing=${missing.join(",")} extra=${extra.map((c) => c.type).join(",")}`,
    );
  }
}
