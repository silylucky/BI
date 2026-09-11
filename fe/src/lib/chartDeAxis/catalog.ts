/**
 * DataEase v2 最新 stable axisConfig 快照（真理源）
 * 对标：dataease/dataease core-frontend panel/charts
 */
import { cartesianTrendAxes, deAxis, DE_MULTI_FIELD_LIMIT, expandAxisSpecs, MULTI_DIM_OPTS, MULTI_MET_OPTS, MIX_SINGLE_MET_OPTS } from "./builders";
import type { DeAxisSlot, DeAxisSpec } from "./types";

type ChartAxisEntry = {
  specs: DeAxisSpec[];
  legacy: Array<{ axisId: DeAxisSpec["id"]; index: number; legacy: DeAxisSlot["legacy"] }>;
};

function entry(specs: DeAxisSpec[], legacy: ChartAxisEntry["legacy"] = []): ChartAxisEntry {
  return { specs, legacy };
}

const CARTESIAN = entry(cartesianTrendAxes(), [
  { axisId: "xAxis", index: 0, legacy: { kind: "dimension", index: 0 } },
  { axisId: "xAxisExt", index: 0, legacy: { kind: "dimension", index: 1 } },
  { axisId: "yAxis", index: 0, legacy: { kind: "metric", index: 0 } },
  { axisId: "drill", index: 0, legacy: { kind: "dimension", index: 2 } },
]);

const PIE = entry(
  [deAxis.xDim("扇区 / 维度"), deAxis.yMet("数值 / 指标")],
  [
    { axisId: "xAxis", index: 0, legacy: { kind: "dimension", index: 0 } },
    { axisId: "yAxis", index: 0, legacy: { kind: "metric", index: 0 } },
  ],
);

const DE_AXIS_CATALOG: Record<string, ChartAxisEntry> = {
  // quota
  gauge: entry([deAxis.yMet("指针角度 / 指标")], [{ axisId: "yAxis", index: 0, legacy: { kind: "metric", index: 0 } }]),
  liquid: entry([deAxis.yMet("进度指示 / 指标")], [{ axisId: "yAxis", index: 0, legacy: { kind: "metric", index: 0 } }]),
  kpi: entry([deAxis.yMet("指标", { required: true })], [{ axisId: "yAxis", index: 0, legacy: { kind: "metric", index: 0 } }]),

  // table
  "table-info": entry(
    [
      deAxis.both("数据列 / 维度或指标", {
        limit: 16,
        required: true,
        uiMode: "multi",
        maxDimensions: 8,
        maxMetrics: 8,
      }),
      deAxis.drill(),
    ],
    [
      { axisId: "xAxis", index: 0, legacy: { kind: "dimension", index: 0 } },
      { axisId: "drill", index: 0, legacy: { kind: "dimension", index: 1 } },
    ],
  ),
  "table-normal": entry(
    [
      deAxis.xDim("数据列 / 维度", { ...MULTI_DIM_OPTS, required: true }),
      deAxis.yMet("数据列 / 指标", { ...MULTI_MET_OPTS, required: true }),
      deAxis.drill(),
    ],
    [
      { axisId: "xAxis", index: 0, legacy: { kind: "dimension", index: 0 } },
      { axisId: "yAxis", index: 0, legacy: { kind: "metric", index: 0 } },
      { axisId: "drill", index: 0, legacy: { kind: "dimension", index: 1 } },
    ],
  ),
  "table-pivot": entry(
    [
      deAxis.xDim("行 / 维度"),
      deAxis.xExt("列 / 维度", { required: false }),
      deAxis.yMet("数值 / 指标"),
    ],
    [
      { axisId: "xAxis", index: 0, legacy: { kind: "dimension", index: 0 } },
      { axisId: "xAxisExt", index: 0, legacy: { kind: "dimension", index: 1 } },
      { axisId: "yAxis", index: 0, legacy: { kind: "metric", index: 0 } },
    ],
  ),
  "t-heatmap": entry(
    [deAxis.xDim("横轴 / 维度"), deAxis.xExt("纵轴 / 维度", { required: true }), deAxis.yMet("数值 / 指标")],
    [
      { axisId: "xAxis", index: 0, legacy: { kind: "dimension", index: 0 } },
      { axisId: "xAxisExt", index: 0, legacy: { kind: "dimension", index: 1 } },
      { axisId: "yAxis", index: 0, legacy: { kind: "metric", index: 0 } },
    ],
  ),
  table: entry(
    [
      deAxis.both("数据列 / 维度或指标", {
        limit: 16,
        required: true,
        uiMode: "multi",
        maxDimensions: 8,
        maxMetrics: 8,
      }),
      deAxis.drill(),
    ],
    [
      { axisId: "xAxis", index: 0, legacy: { kind: "dimension", index: 0 } },
      { axisId: "drill", index: 0, legacy: { kind: "dimension", index: 1 } },
    ],
  ),

  // trend
  line: CARTESIAN,
  area: CARTESIAN,
  "area-stack": entry(cartesianTrendAxes("堆叠项 / 维度"), CARTESIAN.legacy),
  timeline: CARTESIAN,

  // compare
  bar: CARTESIAN,
  "bar-stack": entry(cartesianTrendAxes("堆叠项 / 维度"), CARTESIAN.legacy),
  "percentage-bar-stack": entry(cartesianTrendAxes("堆叠项 / 维度"), CARTESIAN.legacy),
  "bar-group": entry(cartesianTrendAxes("分组项 / 维度"), CARTESIAN.legacy),
  "bar-group-stack": entry(cartesianTrendAxes("分组项 / 维度"), CARTESIAN.legacy),
  "bar-horizontal": CARTESIAN,
  "bar-stack-horizontal": entry(cartesianTrendAxes("堆叠项 / 维度"), CARTESIAN.legacy),
  "percentage-bar-stack-horizontal": entry(cartesianTrendAxes("堆叠项 / 维度"), CARTESIAN.legacy),
  waterfall: entry(
    [deAxis.xDim("类别 / 维度"), deAxis.yMet("数值 / 指标")],
    [
      { axisId: "xAxis", index: 0, legacy: { kind: "dimension", index: 0 } },
      { axisId: "yAxis", index: 0, legacy: { kind: "metric", index: 0 } },
    ],
  ),
  "bar-range": entry(
    [
      deAxis.xDim("类别 / 维度"),
      deAxis.yMet("开始值 / 时间维度或指标", { fieldType: "both" as never, label: "开始值 / 时间维度或指标" }),
      deAxis.yExt("结束值 / 时间维度或指标"),
    ].map((s, i) => (i === 1 ? { ...s, fieldType: "both" as const } : i === 2 ? { ...s, id: "yAxisExt" as const, fieldType: "both" as const, label: "结束值 / 时间维度或指标" } : s)) as DeAxisSpec[],
    [
      { axisId: "xAxis", index: 0, legacy: { kind: "dimension", index: 0 } },
      { axisId: "yAxis", index: 0, legacy: { kind: "metric", index: 0 } },
      { axisId: "yAxisExt", index: 0, legacy: { kind: "metric", index: 1 } },
    ],
  ),
  "bidirectional-bar": entry(
    [deAxis.xDim("类别轴 / 维度"), deAxis.yMet("左值轴 / 指标"), deAxis.yExt("右值轴 / 指标")],
    [
      { axisId: "xAxis", index: 0, legacy: { kind: "dimension", index: 0 } },
      { axisId: "yAxis", index: 0, legacy: { kind: "metric", index: 0 } },
      { axisId: "yAxisExt", index: 0, legacy: { kind: "metric", index: 1 } },
    ],
  ),
  "progress-bar": entry(
    [deAxis.xDim("类别 / 维度"), deAxis.yMet("目标值 / 指标"), deAxis.yExt("实际值 / 指标")],
    [
      { axisId: "xAxis", index: 0, legacy: { kind: "dimension", index: 0 } },
      { axisId: "yAxis", index: 0, legacy: { kind: "metric", index: 0 } },
      { axisId: "yAxisExt", index: 0, legacy: { kind: "metric", index: 1 } },
    ],
  ),
  "stock-line": entry(
    [
      deAxis.xDim("日期 / 维度"),
      {
        id: "yAxis",
        label: "开盘价-收盘价-最低价-最高价 / 指标",
        fieldType: "metric",
        limit: 4,
        required: true,
        showAggregation: true,
        slotLabels: ["开盘价", "收盘价", "最低价", "最高价"],
      },
    ],
    [
      { axisId: "xAxis", index: 0, legacy: { kind: "dimension", index: 0 } },
      { axisId: "yAxis", index: 0, legacy: { kind: "metric", index: 0 } },
      { axisId: "yAxis", index: 1, legacy: { kind: "metric", index: 1 } },
      { axisId: "yAxis", index: 2, legacy: { kind: "metric", index: 2 } },
      { axisId: "yAxis", index: 3, legacy: { kind: "metric", index: 3 } },
    ],
  ),
  "bullet-graph": entry(
    [
      deAxis.xDim("类别 / 维度"),
      deAxis.yMet("实际值 / 指标"),
      deAxis.yExt("目标值 / 指标"),
      deAxis.bubble("区间背景 / 指标"),
    ],
    [
      { axisId: "xAxis", index: 0, legacy: { kind: "dimension", index: 0 } },
      { axisId: "yAxis", index: 0, legacy: { kind: "metric", index: 0 } },
      { axisId: "yAxisExt", index: 0, legacy: { kind: "metric", index: 1 } },
      { axisId: "extBubble", index: 0, legacy: { kind: "metric", index: 2 } },
    ],
  ),

  // distribute
  pie: PIE,
  "pie-donut": PIE,
  "pie-rose": PIE,
  "pie-donut-rose": PIE,
  radar: entry(
    [deAxis.xDim("分支标签 / 维度"), deAxis.yMet("分支长度 / 指标")],
    PIE.legacy,
  ),
  treemap: entry(
    [deAxis.xDim("色块标签 / 维度"), deAxis.yMet("色块大小 / 指标")],
    PIE.legacy,
  ),
  "word-cloud": entry(
    [deAxis.both("词标签 / 时间维度或指标", { label: "词标签 / 时间维度或指标" }), deAxis.yMet("词大小 / 指标")],
    [
      { axisId: "xAxis", index: 0, legacy: { kind: "dimension", index: 0 } },
      { axisId: "yAxis", index: 0, legacy: { kind: "metric", index: 0 } },
    ],
  ),
  wordCloud: entry(
    [deAxis.both("词标签 / 时间维度或指标"), deAxis.yMet("词大小 / 指标")],
    [
      { axisId: "xAxis", index: 0, legacy: { kind: "dimension", index: 0 } },
      { axisId: "yAxis", index: 0, legacy: { kind: "metric", index: 0 } },
    ],
  ),

  // map
  map: entry(
    [
      deAxis.xDim("地区 / 维度"),
      deAxis.yMet("数据 / 指标"),
      deAxis.drill("钻取 / 维度", { limit: 2, required: false, slotLabels: ["市级", "区县"] }),
    ],
    [
      { axisId: "xAxis", index: 0, legacy: { kind: "dimension", index: 0 } },
      { axisId: "yAxis", index: 0, legacy: { kind: "metric", index: 0 } },
      { axisId: "drill", index: 0, legacy: { kind: "dimension", index: 1 } },
      { axisId: "drill", index: 1, legacy: { kind: "dimension", index: 2 } },
    ],
  ),
  "map-3d": entry(
    [
      deAxis.xDim("地区 / 维度"),
      deAxis.yMet("数据 / 指标"),
      deAxis.drill("钻取 / 维度", { limit: 2, required: false, slotLabels: ["市级", "区县"] }),
    ],
    [
      { axisId: "xAxis", index: 0, legacy: { kind: "dimension", index: 0 } },
      { axisId: "yAxis", index: 0, legacy: { kind: "metric", index: 0 } },
      { axisId: "drill", index: 0, legacy: { kind: "dimension", index: 1 } },
      { axisId: "drill", index: 1, legacy: { kind: "dimension", index: 2 } },
    ],
  ),
  /** 全球 PMTiles 底图 + 可选经纬度散点（见 gisMapOverlay.ts） */
  "gis-map": entry(
    [
      deAxis.xDim("经度", { required: false }),
      deAxis.xExt("纬度", { required: false }),
      deAxis.yMet("数值 / 指标", { required: false, showAggregation: true }),
      deAxis.drill("标签 / 维度", {
        limit: 1,
        required: false,
        slotLabels: ["标签"],
      }),
    ],
    [
      { axisId: "xAxis", index: 0, legacy: { kind: "dimension", index: 0 } },
      { axisId: "xAxisExt", index: 0, legacy: { kind: "dimension", index: 1 } },
      { axisId: "yAxis", index: 0, legacy: { kind: "metric", index: 0 } },
      { axisId: "drill", index: 0, legacy: { kind: "dimension", index: 2 } },
    ],
  ),
  heatmap: entry(
    [deAxis.xDim("横轴 / 维度"), deAxis.xExt("纵轴 / 维度", { required: true }), deAxis.yMet("数值 / 指标")],
    [
      { axisId: "xAxis", index: 0, legacy: { kind: "dimension", index: 0 } },
      { axisId: "xAxisExt", index: 0, legacy: { kind: "dimension", index: 1 } },
      { axisId: "yAxis", index: 0, legacy: { kind: "metric", index: 0 } },
    ],
  ),

  // relation
  scatter: entry(
    [deAxis.xDim("类别轴 / 维度"), deAxis.yMet("值轴 / 指标"), deAxis.bubble()],
    [
      { axisId: "xAxis", index: 0, legacy: { kind: "dimension", index: 0 } },
      { axisId: "yAxis", index: 0, legacy: { kind: "metric", index: 0 } },
      { axisId: "extBubble", index: 0, legacy: { kind: "metric", index: 1 } },
    ],
  ),
  quadrant: entry(
    [
      deAxis.xDim("类别 / 维度"),
      deAxis.yMet("X 轴 / 指标"),
      deAxis.yExt("Y 轴 / 指标"),
      deAxis.bubble(),
    ],
    [
      { axisId: "xAxis", index: 0, legacy: { kind: "dimension", index: 0 } },
      { axisId: "yAxis", index: 0, legacy: { kind: "metric", index: 0 } },
      { axisId: "yAxisExt", index: 0, legacy: { kind: "metric", index: 1 } },
      { axisId: "extBubble", index: 0, legacy: { kind: "metric", index: 2 } },
    ],
  ),
  "multi-scatter": entry(
    [
      deAxis.color(),
      deAxis.both("X 轴 / 时间维度或指标", { required: false }),
      deAxis.yMet("Y 轴 / 指标"),
      deAxis.yExt("明暗 / 指标", { required: false }),
      deAxis.bubble("气泡大小 / 指标"),
    ],
    [
      { axisId: "extColor", index: 0, legacy: { kind: "dimension", index: 0 } },
      { axisId: "xAxis", index: 0, legacy: { kind: "metric", index: 1 } },
      { axisId: "yAxis", index: 0, legacy: { kind: "metric", index: 0 } },
      { axisId: "yAxisExt", index: 0, legacy: { kind: "metric", index: 2 } },
      { axisId: "extBubble", index: 0, legacy: { kind: "metric", index: 3 } },
    ],
  ),
  funnel: entry(
    [deAxis.xDim("漏斗分层 / 维度"), deAxis.yMet("漏斗层宽 / 指标")],
    PIE.legacy,
  ),
  sankey: entry(
    [
      deAxis.xDim("起始 / 维度"),
      deAxis.xExt("终点 / 维度", { required: true }),
      deAxis.yMet("边权 / 指标"),
    ],
    [
      { axisId: "xAxis", index: 0, legacy: { kind: "dimension", index: 0 } },
      { axisId: "xAxisExt", index: 0, legacy: { kind: "dimension", index: 1 } },
      { axisId: "yAxis", index: 0, legacy: { kind: "metric", index: 0 } },
    ],
  ),
  graph: entry(
    [
      deAxis.xDim("起点 / 维度"),
      deAxis.xExt("终点 / 维度", { required: true }),
      deAxis.yMet("关系 / 指标", { required: false }),
    ],
    [
      { axisId: "xAxis", index: 0, legacy: { kind: "dimension", index: 0 } },
      { axisId: "xAxisExt", index: 0, legacy: { kind: "dimension", index: 1 } },
      { axisId: "yAxis", index: 0, legacy: { kind: "metric", index: 0 } },
    ],
  ),
  "circle-packing": entry(
    [deAxis.xDim("圆形名称 / 维度"), deAxis.yMet("圆形大小 / 指标")],
    PIE.legacy,
  ),

  // dual_axes
  combo: entry(
    [
      deAxis.xDim("类别轴 / 维度", MULTI_DIM_OPTS),
      deAxis.yMet("左值轴 / 柱指标", { ...MIX_SINGLE_MET_OPTS, required: false }),
      deAxis.rightSubDim(),
      deAxis.yExt("右值轴 / 线指标", { ...MIX_SINGLE_MET_OPTS, required: false }),
      deAxis.drill(),
    ],
    [
      { axisId: "xAxis", index: 0, legacy: { kind: "dimension", index: 0 } },
      { axisId: "yAxis", index: 0, legacy: { kind: "metric", index: 0 } },
      { axisId: "extBubble", index: 0, legacy: { kind: "dimension", index: 1 } },
      { axisId: "yAxisExt", index: 0, legacy: { kind: "metric", index: 1 } },
      { axisId: "drill", index: 0, legacy: { kind: "dimension", index: 2 } },
    ],
  ),
  "chart-mix": entry(
    [
      deAxis.xDim("类别轴 / 维度", MULTI_DIM_OPTS),
      deAxis.yMet("左值轴 / 柱指标", { ...MIX_SINGLE_MET_OPTS, required: false }),
      deAxis.rightSubDim(),
      deAxis.yExt("右值轴 / 线指标", { ...MIX_SINGLE_MET_OPTS, required: false }),
      deAxis.drill(),
    ],
    [
      { axisId: "xAxis", index: 0, legacy: { kind: "dimension", index: 0 } },
      { axisId: "yAxis", index: 0, legacy: { kind: "metric", index: 0 } },
      { axisId: "extBubble", index: 0, legacy: { kind: "dimension", index: 1 } },
      { axisId: "yAxisExt", index: 0, legacy: { kind: "metric", index: 1 } },
      { axisId: "drill", index: 0, legacy: { kind: "dimension", index: 2 } },
    ],
  ),
  "chart-mix-group": entry(
    [
      deAxis.xDim("类别轴 / 维度", MULTI_DIM_OPTS),
      deAxis.mixGroupSubDim(),
      deAxis.yMet("左值轴 / 柱指标", { ...MIX_SINGLE_MET_OPTS, required: false }),
      deAxis.rightSubDim(),
      deAxis.yExt("右值轴 / 线指标", { ...MIX_SINGLE_MET_OPTS, required: false }),
      deAxis.drill(),
    ],
    [
      { axisId: "xAxis", index: 0, legacy: { kind: "dimension", index: 0 } },
      { axisId: "yAxis", index: 0, legacy: { kind: "metric", index: 0 } },
      { axisId: "extBubble", index: 0, legacy: { kind: "dimension", index: 2 } },
      { axisId: "yAxisExt", index: 0, legacy: { kind: "metric", index: 1 } },
      { axisId: "xAxisExt", index: 0, legacy: { kind: "dimension", index: 1 } },
      { axisId: "drill", index: 0, legacy: { kind: "dimension", index: 3 } },
    ],
  ),
  "chart-mix-stack": entry(
    [
      deAxis.xDim("类别轴 / 维度", MULTI_DIM_OPTS),
      deAxis.stackItem(),
      deAxis.yMet("左值轴 / 柱指标", { ...MIX_SINGLE_MET_OPTS, required: false }),
      deAxis.rightSubDim(),
      deAxis.yExt("右值轴 / 线指标", { ...MIX_SINGLE_MET_OPTS, required: false }),
      deAxis.drill(),
    ],
    [
      { axisId: "xAxis", index: 0, legacy: { kind: "dimension", index: 0 } },
      { axisId: "yAxis", index: 0, legacy: { kind: "metric", index: 0 } },
      { axisId: "extBubble", index: 0, legacy: { kind: "dimension", index: 2 } },
      { axisId: "yAxisExt", index: 0, legacy: { kind: "metric", index: 1 } },
      { axisId: "extStack", index: 0, legacy: { kind: "dimension", index: 1 } },
      { axisId: "drill", index: 0, legacy: { kind: "dimension", index: 3 } },
    ],
  ),
  "chart-mix-dual-line": entry(
    [
      deAxis.xDim("类别轴 / 维度", MULTI_DIM_OPTS),
      deAxis.leftSubDim(),
      deAxis.yMet("左值轴 / 线指标", { ...MIX_SINGLE_MET_OPTS, required: false }),
      deAxis.rightSubDim(),
      deAxis.yExt("右值轴 / 线指标", { ...MIX_SINGLE_MET_OPTS, required: false }),
      deAxis.drill(),
    ],
    [
      { axisId: "xAxis", index: 0, legacy: { kind: "dimension", index: 0 } },
      { axisId: "xAxisExt", index: 0, legacy: { kind: "dimension", index: 1 } },
      { axisId: "yAxis", index: 0, legacy: { kind: "metric", index: 0 } },
      { axisId: "extBubble", index: 0, legacy: { kind: "dimension", index: 2 } },
      { axisId: "yAxisExt", index: 0, legacy: { kind: "metric", index: 1 } },
      { axisId: "drill", index: 0, legacy: { kind: "dimension", index: 3 } },
    ],
  ),
};

// Fix bar-range entry - the hack above is messy, define cleanly:
DE_AXIS_CATALOG["bar-range"] = entry(
  [
    deAxis.xDim("类别 / 维度"),
    { id: "yAxis", label: "开始值 / 时间维度或指标", fieldType: "both", limit: 1, required: true, showAggregation: true },
    { id: "yAxisExt", label: "结束值 / 时间维度或指标", fieldType: "both", limit: 1, required: true, showAggregation: true },
  ],
  [
    { axisId: "xAxis", index: 0, legacy: { kind: "dimension", index: 0 } },
    { axisId: "yAxis", index: 0, legacy: { kind: "metric", index: 0 } },
    { axisId: "yAxisExt", index: 0, legacy: { kind: "metric", index: 1 } },
  ],
);

DE_AXIS_CATALOG["word-cloud"] = entry(
  [
    { id: "xAxis", label: "词标签 / 时间维度或指标", fieldType: "both", limit: 1, required: true },
    deAxis.yMet("词大小 / 指标"),
  ],
  [
    { axisId: "xAxis", index: 0, legacy: { kind: "dimension", index: 0 } },
    { axisId: "yAxis", index: 0, legacy: { kind: "metric", index: 0 } },
  ],
);

DE_AXIS_CATALOG["multi-scatter"] = entry(
  [
    deAxis.color(),
    { id: "xAxis", label: "X 轴 / 时间维度或指标", fieldType: "both", limit: 1, required: true },
    deAxis.yMet("Y 轴 / 指标"),
    deAxis.yExt("明暗 / 指标", { required: false }),
    deAxis.bubble("气泡大小 / 指标"),
  ],
  [
    { axisId: "extColor", index: 0, legacy: { kind: "dimension", index: 0 } },
    { axisId: "xAxis", index: 0, legacy: { kind: "metric", index: 1 } },
    { axisId: "yAxis", index: 0, legacy: { kind: "metric", index: 0 } },
    { axisId: "yAxisExt", index: 0, legacy: { kind: "metric", index: 2 } },
    { axisId: "extBubble", index: 0, legacy: { kind: "metric", index: 3 } },
  ],
);

export function getDeAxisSpecs(chartType: string): DeAxisSpec[] {
  return DE_AXIS_CATALOG[chartType]?.specs ?? CARTESIAN.specs;
}

export function getDeAxisBlueprint(chartType: string): DeAxisSlot[] {
  const entry = DE_AXIS_CATALOG[chartType] ?? CARTESIAN;
  return expandAxisSpecs(entry.specs, entry.legacy);
}

export function getDeAxisLegacyMap(chartType: string): ChartAxisEntry["legacy"] {
  return DE_AXIS_CATALOG[chartType]?.legacy ?? CARTESIAN.legacy;
}

export function deriveFieldRuleFromDeCatalog(chartType: string): {
  minDimensions: number;
  maxDimensions: number;
  minMetrics: number;
  maxMetrics: number;
} {
  const entry = DE_AXIS_CATALOG[chartType] ?? CARTESIAN;
  const specs = entry.specs;
  let minD = 0;
  let maxD = 0;
  let minM = 0;
  let maxM = 0;
  for (const spec of specs) {
    if (spec.fieldType === "both" && spec.uiMode === "multi") {
      maxD += spec.maxDimensions ?? 8;
      maxM += spec.maxMetrics ?? 8;
      continue;
    }
    if (spec.uiMode === "multi") {
      if (spec.fieldType === "dimension") {
        maxD += spec.maxDimensions ?? spec.limit;
        if (spec.required) minD += 1;
      } else if (spec.fieldType === "metric") {
        maxM += spec.maxMetrics ?? spec.limit;
        if (spec.required) minM += 1;
      }
      continue;
    }
    if (spec.fieldType === "both") {
      const legacy = entry.legacy.find((m) => m.axisId === spec.id && m.index === 0)?.legacy;
      if (legacy?.kind === "metric") {
        maxM += spec.limit;
        if (spec.required) minM += 1;
      } else if (legacy?.kind === "dimension") {
        maxD += spec.limit;
        if (spec.required) minD += 1;
      } else if (spec.id === "yAxis" || spec.id === "yAxisExt") {
        maxM += spec.limit;
        if (spec.required) minM += 1;
      } else {
        maxD += spec.limit;
        maxM += spec.limit;
        if (spec.required) {
          minD += 1;
          minM += 1;
        }
      }
    } else {
      if (spec.fieldType === "dimension") maxD += spec.limit;
      if (spec.fieldType === "metric") maxM += spec.limit;
      if (spec.required && spec.fieldType === "dimension") minD += spec.limit;
      if (spec.required && spec.fieldType === "metric") minM += spec.limit;
    }
  }
  const hasMultiCategory =
    !chartType.startsWith("table-") &&
    specs.some(
      (s) => s.id === "xAxis" && s.uiMode === "multi" && s.fieldType === "dimension",
    );
  if (hasMultiCategory) {
    maxD = DE_MULTI_FIELD_LIMIT;
    maxM = Math.min(maxM, DE_MULTI_FIELD_LIMIT);
    if (minD < 1) minD = 1;
  }
  const dualAxesCombo =
    chartType === "combo" ||
    chartType === "chart-mix" ||
    chartType === "chart-mix-group" ||
    chartType === "chart-mix-stack" ||
    chartType === "chart-mix-dual-line";
  if (dualAxesCombo) {
    minM = Math.max(minM, 1);
  }
  return { minDimensions: minD, maxDimensions: maxD, minMetrics: minM, maxMetrics: maxM };
}

export { DE_AXIS_CATALOG };
