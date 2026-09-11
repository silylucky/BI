import type { NumberFormatConfig } from "@/components/dashboard/dashboardStyleConfig";

/** 类目轴标签旋转：未配置与 `0` 为水平；`auto` 为按槽宽智能倾斜 */
export type AxisLabelRotate = number | "auto";

export type ChartAxisSideStyle = {
  show?: boolean;
  name?: string;
  lineColor?: string;
  lineWidth?: number;
  labelRotate?: AxisLabelRotate;
  formatType?: NumberFormatConfig["type"];
};

export type ChartAxisStyle = {
  x?: ChartAxisSideStyle;
  y?: ChartAxisSideStyle;
};

export type ChartCartesianStyle = {
  barWidthRatio?: number;
  barRadius?: number;
  lineSmooth?: boolean;
  lineWidth?: number;
  pointSize?: number;
  areaOpacity?: number;
};

export type ChartPieShapeStyle = {
  innerRadiusPercent?: number;
  outerRadiusPercent?: number;
  padAngle?: number;
  mergeOthers?: boolean;
  topN?: number;
  otherLabel?: string;
};

export type ChartGaugeStyle = {
  min?: number;
  max?: number;
  startAngleDeg?: number;
  endAngleDeg?: number;
  pointerColor?: string;
  splitNumber?: number;
};

export type ChartLiquidStyle = {
  /** 目标值类型：固定值 / 动态字段聚合（对标 DE liquidMaxType） */
  maxType?: "fix" | "dynamic";
  /** 固定目标值；水位 = 指标 / max */
  max?: number;
  /** 动态目标字段名（sum 聚合） */
  maxField?: string;
  /** 图形大小 %，对标 DE liquidSize，默认 80 */
  size?: number;
  outlineWidth?: number;
  waveColor?: string;
  /** @deprecated 旧参考线语义，不再参与水位计算 */
  targetValue?: number;
};

export type ChartKpiStyle = {
  fontSize?: number;
  align?: "left" | "center" | "right";
};

export type ChartFunnelStyle = {
  sort?: "descending" | "ascending" | "none";
  gap?: number;
  showConversionRate?: boolean;
};

export type ChartSankeyStyle = {
  nodeWidth?: number;
  nodeGap?: number;
  linkOpacity?: number;
};

export type ChartGraphStyle = {
  layout?: "force" | "dagre";
  edgeLength?: number;
  repulsion?: number;
};

export type ChartRadarStyle = {
  shape?: "polygon" | "circle";
  areaOpacity?: number;
  showArea?: boolean;
  showAxisName?: boolean;
  showSymbol?: boolean;
  axisLabelColor?: string;
  axisLineColor?: string;
  axisLineWidth?: number;
  splitNumber?: number;
  /** 雷达半径占可用区域比例（对标 DataEase 半径） */
  radiusPercent?: number;
};

export const DEFAULT_RADAR_RADIUS_PERCENT = 65;
export const RADAR_RADIUS_PERCENT_MIN = 30;
export const RADAR_RADIUS_PERCENT_MAX = 92;

export type ChartWordCloudStyle = {
  fontSizeMin?: number;
  fontSizeMax?: number;
  spacing?: number;
};

export type ChartTreemapStyle = {
  paddingInner?: number;
  paddingOuter?: number;
  cellRadius?: number;
};

export type ChartCirclePackingStyle = {
  layoutPadding?: number;
  labelMinRadius?: number;
  /** 外圆内部填充色 */
  backgroundColor?: string;
  /** 整体大小（相对绘图区直径，%） */
  sizePercent?: number;
  /** 是否显示外圈描边 */
  showOuterRing?: boolean;
};

export const DEFAULT_CIRCLE_PACKING_SIZE_PERCENT = 100;

export type ChartQuadrantStyle = {
  lineColor?: string;
  lineWidth?: number;
  showRegionBg?: boolean;
  regionOpacity?: number;
};

export type ChartProgressBarStyle = {
  trackOpacity?: number;
};

export type ChartBulletStyle = {
  targetLineWidth?: number;
  rangeOpacity?: number;
};

export type ChartStockLineStyle = {
  bodyWidthRatio?: number;
};

export const DEFAULT_CARTESIAN_BAR_WIDTH_RATIO = 0.55;
export const DEFAULT_CARTESIAN_POINT_SIZE = 4;
export const DEFAULT_CARTESIAN_LINE_WIDTH = 2.5;
export const DEFAULT_PIE_INNER_RADIUS_PERCENT = 40;
export const DEFAULT_PIE_OUTER_RADIUS_PERCENT = 77;
export const DEFAULT_PIE_MERGE_TOP_N = 35;
export const DEFAULT_PIE_OTHER_LABEL = "其他";
export const PIE_INNER_RADIUS_MIN = 0;
export const PIE_INNER_RADIUS_MAX = 65;
export const DEFAULT_GAUGE_MIN = 0;
export const DEFAULT_GAUGE_MAX = 100;
export const DEFAULT_LIQUID_SIZE = 80;
/** 未配置固定目标值时：目标 = 指标 × 此倍率（水位 ≈ 66.7%） */
export const DEFAULT_LIQUID_MAX_MULTIPLIER = 1.5;

export function defaultLiquidFixMaxFromMetric(metric: number): number {
  const value = Number.isFinite(metric) ? metric : 0;
  return Math.max(value * DEFAULT_LIQUID_MAX_MULTIPLIER, 1e-6);
}
export const DEFAULT_TREEMAP_PADDING_INNER = 0;
export const DEFAULT_TREEMAP_PADDING_OUTER = 4;
export const DEFAULT_TREEMAP_CELL_RADIUS = 0;

export type ChartDeStyleBlocks = {
  axis?: ChartAxisStyle;
  cartesian?: ChartCartesianStyle;
  gauge?: ChartGaugeStyle;
  liquid?: ChartLiquidStyle;
  kpi?: ChartKpiStyle;
  funnel?: ChartFunnelStyle;
  sankey?: ChartSankeyStyle;
  graph?: ChartGraphStyle;
  radar?: ChartRadarStyle;
  wordCloud?: ChartWordCloudStyle;
  treemap?: ChartTreemapStyle;
  circlePacking?: ChartCirclePackingStyle;
  quadrant?: ChartQuadrantStyle;
  progressBar?: ChartProgressBarStyle;
  bullet?: ChartBulletStyle;
  stockLine?: ChartStockLineStyle;
};
