import type { ChartDeStyle } from "@/lib/chartDeStyle";
import type { ChartRenderPlan } from "@/components/charts/engine/buildChartRenderPlan";
import { applyPieMergeTopN } from "@/components/charts/engine/antv/spec/encodePie";
import {
  DEFAULT_CARTESIAN_BAR_WIDTH_RATIO,
  DEFAULT_CARTESIAN_LINE_WIDTH,
  DEFAULT_CARTESIAN_POINT_SIZE,
  DEFAULT_GAUGE_MAX,
  DEFAULT_GAUGE_MIN,
  DEFAULT_LIQUID_SIZE,
  defaultLiquidFixMaxFromMetric,
  DEFAULT_PIE_OUTER_RADIUS_PERCENT,
  type ChartAxisStyle,
  type ChartDeStyleBlocks,
  type ChartLiquidStyle,
} from "@/lib/chartDeStyleBlocks";
import { aggregateQuotaMetric } from "@/lib/quotaMetricAggregate";
import { resolveLiquidMetricFormat } from "@/lib/liquidLabelFormat";
import type { ChartType } from "@/lib/chartViewConfig";
import { isPieRoseOnlyChartType, shouldApplyPieInnerRadius } from "@/lib/defaultPieChartDeStyle";

export type PlanCompareStyle = {
  trackOpacity?: number;
  targetLineWidth?: number;
  rangeOpacity?: number;
  bodyWidthRatio?: number;
  quadrantLineColor?: string;
  quadrantLineWidth?: number;
  quadrantShowRegionBg?: boolean;
  quadrantRegionOpacity?: number;
};

/** 从 plan.options 读取 compare / quadrant 样式块 */
export function readCompareStyleFromPlanOptions(
  options: Record<string, unknown>,
): PlanCompareStyle {
  return {
    trackOpacity: options.__progressBarTrackOpacity as number | undefined,
    targetLineWidth: options.__bulletTargetLineWidth as number | undefined,
    rangeOpacity: options.__bulletRangeOpacity as number | undefined,
    bodyWidthRatio: options.__stockBodyWidthRatio as number | undefined,
    quadrantLineColor: options.__quadrantLineColor as string | undefined,
    quadrantLineWidth: options.__quadrantLineWidth as number | undefined,
    quadrantShowRegionBg:
      options.__quadrantShowRegionBg != null ? Boolean(options.__quadrantShowRegionBg) : undefined,
    quadrantRegionOpacity: options.__quadrantRegionOpacity as number | undefined,
  };
}

export type PlanCartesianStyle = {
  barWidthRatio?: number;
  barRadius?: number;
  lineWidth?: number;
  pointSize?: number;
  areaOpacity?: number;
  smooth?: boolean;
  axisStyle?: ChartAxisStyle;
};

/** deStyle.cartesian.lineSmooth 优先；其次 plan.options.smooth；最后 styleVariant=smooth */
export function resolveCartesianLineSmooth(opts: {
  lineSmooth?: boolean;
  planSmooth?: unknown;
  styleVariant?: string;
}): boolean {
  if (opts.lineSmooth !== undefined) {
    return opts.lineSmooth;
  }
  if (opts.planSmooth != null) {
    return Boolean(opts.planSmooth);
  }
  return opts.styleVariant === "smooth";
}

function planUsesLineSmooth(plan: ChartRenderPlan): boolean {
  if (plan.kind !== "d3") return false;
  if (plan.plotType === "Line" || plan.plotType === "DualAxes") return true;
  return Boolean(plan.options.area);
}

/** 从 style chain 后的 plan.options 读取笛卡尔样式块 */
export function readCartesianStyleFromPlanOptions(
  options: Record<string, unknown>,
): PlanCartesianStyle {
  return {
    barWidthRatio: options.__barWidthRatio as number | undefined,
    barRadius: options.__barRadius as number | undefined,
    lineWidth: options.__lineWidth as number | undefined,
    pointSize: options.__pointSize as number | undefined,
    areaOpacity: options.__areaOpacity as number | undefined,
    smooth: options.smooth != null ? Boolean(options.smooth) : undefined,
    axisStyle: options.__axisStyle as ChartAxisStyle | undefined,
  };
}

export function resolveGaugeValuePercent(
  options: Record<string, unknown>,
  rawValue: number,
  fallbackPercent: number,
): number {
  const min = Number(options.__gaugeMin ?? DEFAULT_GAUGE_MIN);
  const max = Number(options.__gaugeMax ?? DEFAULT_GAUGE_MAX);
  const span = Math.max(max - min, 1e-6);
  if (Number.isFinite(rawValue)) {
    return Math.min(1, Math.max(0, (rawValue - min) / span));
  }
  return Math.min(1, Math.max(0, fallbackPercent));
}

function resolveLiquidMaxValue(
  options: Record<string, unknown>,
  liquid: ChartLiquidStyle,
  rawValue: number,
): number {
  const maxType = liquid.maxType ?? "fix";
  if (maxType === "dynamic") {
    const field = liquid.maxField?.trim();
    const rows = options.rows as unknown[][] | undefined;
    const columns = options.columns as string[] | undefined;
    if (field && rows && columns && columns.includes(field)) {
      const aggregated = aggregateQuotaMetric(rows, columns, field);
      if (aggregated > 0) {
        return Math.max(aggregated, 1e-6);
      }
    }
    return defaultLiquidFixMaxFromMetric(rawValue);
  }
  if (liquid.max != null && Number.isFinite(liquid.max)) {
    return Math.max(liquid.max, 1e-6);
  }
  return defaultLiquidFixMaxFromMetric(rawValue);
}

/** 对标 DE：labelPercent = value/max；fill 封顶 100% */
export function resolveLiquidPercent(
  options: Record<string, unknown>,
  rawValue: number,
  liquid?: ChartLiquidStyle,
): { fillPercent: number; labelPercent: number; max: number } {
  const value = Number.isFinite(rawValue) ? rawValue : 0;
  const max = resolveLiquidMaxValue(options, liquid ?? {}, value);
  const labelPercent = value / max;
  const fillPercent = Math.min(1, Math.max(0, labelPercent));
  return { fillPercent, labelPercent, max };
}

function applyLiquidStyleToPlan(
  options: Record<string, unknown>,
  liquid: ChartLiquidStyle,
): void {
  if (liquid.maxType) options.__liquidMaxType = liquid.maxType;
  if (liquid.max != null) options.__liquidMax = liquid.max;
  if (liquid.maxField) options.__liquidMaxField = liquid.maxField;
  if (liquid.size != null) options.__liquidSize = liquid.size;
  if (liquid.outlineWidth != null) options.__liquidOutlineWidth = liquid.outlineWidth;
  if (liquid.waveColor) options.__liquidWaveColor = liquid.waveColor;

  const rawValue = Number(options.rawValue ?? 0);
  const resolved = resolveLiquidPercent(options, rawValue, liquid);
  options.__liquidMax = resolved.max;
  options.__liquidFillPercent = resolved.fillPercent;
  options.__liquidLabelPercent = resolved.labelPercent;
}

function readBlocks(deStyle: ChartDeStyle): ChartDeStyleBlocks {
  return deStyle as ChartDeStyle & ChartDeStyleBlocks;
}

/** 将 deStyle 类型块映射进 D3 render plan.options */
export function applyChartDeStyleBlocksToPlan(
  plan: ChartRenderPlan,
  deStyle: ChartDeStyle,
  opts?: { styleVariant?: string; chartType?: ChartType },
): ChartRenderPlan {
  if (plan.kind !== "d3") return plan;
  const blocks = readBlocks(deStyle);
  const options = { ...plan.options };

  if (blocks.cartesian) {
    const c = blocks.cartesian;
    if (c.barWidthRatio != null) options.__barWidthRatio = c.barWidthRatio;
    if (c.barRadius != null) options.__barRadius = c.barRadius;
    if (c.lineWidth != null) options.__lineWidth = c.lineWidth;
    if (c.pointSize != null) options.__pointSize = c.pointSize;
    if (c.areaOpacity != null) options.__areaOpacity = c.areaOpacity;
  }

  if (blocks.axis) {
    options.__axisStyle = blocks.axis;
  }

  if (plan.plotType === "Pie" && deStyle.pie) {
    const pie = deStyle.pie;
    if (
      pie.innerRadiusPercent != null &&
      pie.innerRadiusPercent > 0 &&
      shouldApplyPieInnerRadius(opts?.chartType, opts?.styleVariant)
    ) {
      options.innerRadius = pie.innerRadiusPercent / 100;
    } else if (isPieRoseOnlyChartType(opts?.chartType, opts?.styleVariant)) {
      options.innerRadius = 0;
    }
    if (pie.outerRadiusPercent != null) {
      options.__outerRadiusPercent = pie.outerRadiusPercent;
    }
    if (pie.padAngle != null) options.__padAngle = pie.padAngle;
    if (pie.mergeOthers && pie.topN != null && Array.isArray(options.data)) {
      options.data = applyPieMergeTopN(options.data as { type: string; value: number }[], {
        topN: pie.topN,
        otherLabel: pie.otherLabel,
      });
    }
  }

  if (plan.plotType === "Pie" && deStyle.label) {
    const label = deStyle.label;
    const position = label.position ?? "inside";
    const outside = position === "outside";
    options.__pieLabelPosition = position;
    options.__pieShowDimension = label.showDimension ?? outside;
    options.__pieShowIndicator = label.showIndicator !== false;
    options.__pieShowPercent = label.showPercent ?? outside;
    options.__piePercentDecimals = label.percentDecimals ?? label.ratioDecimals ?? 2;
    options.__pieShowAll = label.showAll === true;
  }

  if (deStyle.label && plan.plotType !== "Pie" && plan.plotType !== "Liquid") {
    const label = deStyle.label;
    options.__labelShowDimension = label.showDimension === true;
    options.__labelShowIndicator = label.showIndicator !== false;
    options.__labelShowPercent = label.showPercent === true;
    options.__labelPercentDecimals = label.percentDecimals ?? label.ratioDecimals ?? 2;
  }

  if (deStyle.paletteOpacity != null && plan.plotType === "Pie") {
    options.__fillOpacity = deStyle.paletteOpacity;
  }

  if (plan.plotType === "Gauge" && blocks.gauge) {
    const g = blocks.gauge;
    if (g.min != null) options.__gaugeMin = g.min;
    if (g.max != null) options.__gaugeMax = g.max;
    if (g.startAngleDeg != null) options.__gaugeStartAngleDeg = g.startAngleDeg;
    if (g.endAngleDeg != null) options.__gaugeEndAngleDeg = g.endAngleDeg;
    if (g.pointerColor) options.__gaugePointerColor = g.pointerColor;
    if (g.splitNumber != null) options.__gaugeSplitNumber = g.splitNumber;
  }

  if (plan.plotType === "Liquid") {
    applyLiquidStyleToPlan(options, blocks.liquid ?? {});
    const label = deStyle.label;
    if (label) {
      options.__liquidShowMetric = label.showMetric !== false;
      options.__liquidShowRatio = label.showRatio === true;
      if (label.ratioDecimals != null) options.__liquidRatioDecimals = label.ratioDecimals;
      options.__liquidMetricFormat = resolveLiquidMetricFormat(label);
    } else {
      options.__liquidShowMetric = true;
      options.__liquidShowRatio = false;
      options.__liquidMetricFormat = resolveLiquidMetricFormat(undefined);
    }
  }

  if (blocks.funnel) {
    const f = blocks.funnel;
    if (f.sort) options.__funnelSort = f.sort;
    if (f.gap != null) options.__funnelGap = f.gap;
    if (f.showConversionRate != null) options.__funnelShowConversion = f.showConversionRate;
  }

  if (blocks.sankey) {
    const s = blocks.sankey;
    if (s.nodeWidth != null) options.__sankeyNodeWidth = s.nodeWidth;
    if (s.nodeGap != null) options.__sankeyNodeGap = s.nodeGap;
    if (s.linkOpacity != null) options.__sankeyLinkOpacity = s.linkOpacity;
  }

  if (blocks.graph) {
    const g = blocks.graph;
    if (g.layout) options.__graphLayout = g.layout;
    if (g.edgeLength != null) options.__graphEdgeLength = g.edgeLength;
    if (g.repulsion != null) options.__graphRepulsion = g.repulsion;
  }

  if (blocks.radar) {
    const r = blocks.radar;
    if (r.shape) options.__radarShape = r.shape;
    if (r.areaOpacity != null) options.__radarAreaOpacity = r.areaOpacity;
    if (r.showArea != null) options.__radarShowArea = r.showArea;
    if (r.showAxisName != null) options.__radarShowAxisName = r.showAxisName;
    if (r.showSymbol != null) options.__radarShowSymbol = r.showSymbol;
    if (r.axisLabelColor) options.__radarAxisLabelColor = r.axisLabelColor;
    if (r.axisLineColor) options.__radarAxisLineColor = r.axisLineColor;
    if (r.axisLineWidth != null) options.__radarAxisLineWidth = r.axisLineWidth;
    if (r.splitNumber != null) options.__radarSplitNumber = r.splitNumber;
    if (r.radiusPercent != null) options.__radarRadiusPercent = r.radiusPercent;
  }

  if (blocks.wordCloud) {
    const w = blocks.wordCloud;
    if (w.fontSizeMin != null) options.__wordCloudFontMin = w.fontSizeMin;
    if (w.fontSizeMax != null) options.__wordCloudFontMax = w.fontSizeMax;
    if (w.spacing != null) options.__wordCloudSpacing = w.spacing;
  }

  if (blocks.treemap) {
    const t = blocks.treemap;
    if (t.paddingInner != null) options.__treemapPaddingInner = t.paddingInner;
    if (t.paddingOuter != null) options.__treemapPaddingOuter = t.paddingOuter;
    if (t.cellRadius != null) options.__treemapCellRadius = t.cellRadius;
  }

  if (blocks.circlePacking) {
    const c = blocks.circlePacking;
    if (c.layoutPadding != null) options.__circlePackingPadding = c.layoutPadding;
    if (c.labelMinRadius != null) options.__circlePackingLabelMinRadius = c.labelMinRadius;
    if (c.backgroundColor) options.__circlePackingBackgroundColor = c.backgroundColor;
    if (c.sizePercent != null) options.__circlePackingSizePercent = c.sizePercent;
    if (c.showOuterRing != null) options.__circlePackingShowOuterRing = c.showOuterRing;
  }

  if (blocks.quadrant) {
    const q = blocks.quadrant;
    if (q.lineColor) options.__quadrantLineColor = q.lineColor;
    if (q.lineWidth != null) options.__quadrantLineWidth = q.lineWidth;
    if (q.showRegionBg != null) options.__quadrantShowRegionBg = q.showRegionBg;
    if (q.regionOpacity != null) options.__quadrantRegionOpacity = q.regionOpacity;
  }

  if (blocks.progressBar) {
    const p = blocks.progressBar;
    if (p.trackOpacity != null) options.__progressBarTrackOpacity = p.trackOpacity;
  }

  if (blocks.bullet) {
    const b = blocks.bullet;
    if (b.targetLineWidth != null) options.__bulletTargetLineWidth = b.targetLineWidth;
    if (b.rangeOpacity != null) options.__bulletRangeOpacity = b.rangeOpacity;
  }

  if (blocks.stockLine) {
    const s = blocks.stockLine;
    if (s.bodyWidthRatio != null) options.__stockBodyWidthRatio = s.bodyWidthRatio;
  }

  if (blocks.kpi) {
    const k = blocks.kpi;
    if (k.fontSize != null) options.__kpiFontSize = k.fontSize;
    if (k.align) options.__kpiAlign = k.align;
  }

  if (planUsesLineSmooth(plan)) {
    options.smooth = resolveCartesianLineSmooth({
      lineSmooth: blocks.cartesian?.lineSmooth,
      planSmooth: plan.options.smooth,
      styleVariant: opts?.styleVariant,
    });
  }

  return { ...plan, options };
}

export function resolveBarBandPadding(barWidthRatio?: number): number {
  const ratio = barWidthRatio ?? DEFAULT_CARTESIAN_BAR_WIDTH_RATIO;
  const clamped = Math.min(0.9, Math.max(0.1, ratio));
  return Math.max(0.05, 1 - clamped);
}

export function resolveCartesianPointSize(pointSize?: number): number {
  return pointSize ?? DEFAULT_CARTESIAN_POINT_SIZE;
}

export function resolveCartesianLineWidth(lineWidth?: number): number {
  return lineWidth ?? DEFAULT_CARTESIAN_LINE_WIDTH;
}

export function resolveGaugeAngles(deStyle: ChartDeStyle): {
  min: number;
  max: number;
  start: number;
  end: number;
} {
  const blocks = readBlocks(deStyle);
  const g = blocks.gauge ?? {};
  return {
    min: g.min ?? DEFAULT_GAUGE_MIN,
    max: g.max ?? DEFAULT_GAUGE_MAX,
    start: g.startAngleDeg ?? -135,
    end: g.endAngleDeg ?? 135,
  };
}

export function resolvePieOuterRadiusPercent(deStyle: ChartDeStyle): number {
  return deStyle.pie?.outerRadiusPercent ?? DEFAULT_PIE_OUTER_RADIUS_PERCENT;
}
