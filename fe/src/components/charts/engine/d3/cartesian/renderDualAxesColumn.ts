import * as d3 from "d3";
import { VCDS } from "@/components/charts/engine/d3/core/chartVisualTokens";
import { paintVerticalBar, resolveEffectiveDepth } from "@/components/charts/engine/d3/core/depthEngine";
import { resolveSeriesGradientFill } from "@/components/charts/engine/d3/core/gradient";
import {
  groupSeries,
  normalizeCartesianData,
  resolveDatumColor,
  resolveSeriesKeys,
  seriesDataKey,
  seriesDomClass,
  seriesDomSelector,
} from "@/components/charts/engine/d3/core/series";
import type { AntvThemeTokens } from "@/components/charts/engine/antv/theme";
import type { ChartConditionalRule } from "@/lib/chartDeFeatures";
import type { D3CartesianDatum } from "@/components/charts/engine/d3/types";
import { DEFAULT_CARTESIAN_BAR_WIDTH_RATIO } from "@/lib/chartDeStyleBlocks";

const BAR_RX = VCDS.bar.rx;
const STACK_GAP = VCDS.bar.stackGap;

type WideRow = Record<string, string | number>;

function paintDualVBarCell(
  cell: d3.Selection<SVGGElement, unknown, null, undefined>,
  opts: { y1: number; h: number; w: number; front: string; solid: string; rx?: number },
): void {
  cell.selectAll("*").remove();
  const depthOn = resolveEffectiveDepth() !== "off";
  paintVerticalBar({
    plot: cell,
    x: 0,
    y1: opts.y1,
    height: opts.h,
    width: opts.w,
    color: depthOn ? opts.solid : opts.front,
    rx: opts.rx ?? BAR_RX,
  });
  if (depthOn && opts.front !== opts.solid) cell.select(".vs-bar-front").attr("fill", opts.front);
}

type ColumnOpts = { isGroup?: boolean; isStack?: boolean };

export type DualAxesColumnLegendItem = { label: string; color: string; w: number; h: number };

export function resolveDualAxesColumnMax(
  columnData: D3CartesianDatum[],
  xField: string,
  columnYField: string,
  columnSeriesField: string | undefined,
  columnOpts: ColumnOpts,
): number {
  const normalized = normalizeCartesianData(columnData, xField, columnYField, columnSeriesField);
  const seriesGroups = groupSeries(normalized, columnSeriesField);
  const seriesNames = seriesGroups.map((s) => s.name);
  const hasMultiSeries = seriesNames.length > 1 && Boolean(columnSeriesField);
  if (columnOpts.isStack && hasMultiSeries) {
    const keys = resolveSeriesKeys(seriesNames);
    const categories = [...new Set(normalized.map((d) => String(d.__category__ ?? "")))];
    const wideRows: WideRow[] = categories.map((cat) => {
      const row: WideRow = { __category__: cat };
      for (const s of seriesGroups) {
        const pt = s.points.find((p) => String(p.__category__) === cat);
        row[seriesDataKey(s.name)] = Number(pt?.__value__ ?? 0);
      }
      return row;
    });
    return d3.max(wideRows, (row) => keys.reduce((sum, k) => sum + Number(row[k] ?? 0), 0)) ?? 0;
  }
  return d3.max(normalized, (d) => Number(d.__value__)) ?? 0;
}

function seriesColorAt(colors: string[], index: number, fallback: string): string {
  return colors[index % colors.length] ?? fallback;
}

export { seriesColorAt };

export function renderDualAxesColumnBars(params: {
  plot: d3.Selection<SVGGElement, unknown, null, undefined>;
  defs?: d3.Selection<SVGDefsElement, unknown, null, undefined>;
  columnData: D3CartesianDatum[];
  xField: string;
  columnYField: string;
  columnSeriesField?: string;
  categories: string[];
  x: d3.ScalePoint<string>;
  yRight: d3.ScaleLinear<number, number>;
  innerH: number;
  innerW: number;
  columnOpts: ColumnOpts;
  colors: string[];
  /** 系列配色起始索引（左柱 0、右柱 1，与图例/tooltip 一致） */
  colorOffset?: number;
  fallbackColor: string;
  theme: AntvThemeTokens;
  seriesGradient?: boolean;
  conditionalRules?: ChartConditionalRule[];
  onPointClick?: (datum: D3CartesianDatum) => void;
  barWidthRatio?: number;
  barRadius?: number;
}): { columnMax: number; legendItems: DualAxesColumnLegendItem[] } {
  const {
    plot,
    defs,
    columnData,
    xField,
    columnYField,
    columnSeriesField,
    categories,
    x,
    yRight,
    innerH,
    innerW,
    columnOpts,
    colors,
    fallbackColor,
    theme,
    seriesGradient = false,
    conditionalRules = [],
    onPointClick,
    barWidthRatio,
    barRadius,
    colorOffset = 0,
  } = params;

  const barRx = barRadius ?? BAR_RX;

  const normalized = normalizeCartesianData(columnData, xField, columnYField, columnSeriesField);
  const seriesGroups = groupSeries(normalized, columnSeriesField);
  const seriesNames = seriesGroups.map((s) => s.name);
  const hasMultiSeries = seriesNames.length > 1 && Boolean(columnSeriesField);
  const useGrouped = hasMultiSeries && (columnOpts.isGroup || !columnOpts.isStack);
  const keys = resolveSeriesKeys(seriesNames);
  const colorScale = d3
    .scaleOrdinal<string>()
    .domain(seriesNames)
    .range(seriesNames.map((_, index) => seriesColorAt(colors, colorOffset + index, fallbackColor)));

  const wideRows: WideRow[] = categories.map((cat) => {
    const row: WideRow = { __category__: cat };
    for (const s of seriesGroups) {
      const pt = s.points.find((p) => String(p.__category__) === cat);
      row[seriesDataKey(s.name)] = Number(pt?.__value__ ?? 0);
    }
    return row;
  });

  const columnMax =
    columnOpts.isStack && hasMultiSeries
      ? (d3.max(wideRows, (row) => keys.reduce((sum, k) => sum + Number(row[k] ?? 0), 0)) ?? 0)
      : (d3.max(normalized, (d) => Number(d.__value__)) ?? 0);

  const widthRatio = barWidthRatio ?? DEFAULT_CARTESIAN_BAR_WIDTH_RATIO;
  const barWidth = Math.min(28, (innerW / Math.max(categories.length, 1)) * widthRatio);
  const legendItems: DualAxesColumnLegendItem[] = [];

  if (columnOpts.isStack && hasMultiSeries) {
    const stack = d3.stack<WideRow>().keys(keys);
    const stackLayers = stack(wideRows);
    for (let layerIndex = 0; layerIndex < stackLayers.length; layerIndex += 1) {
      const layer = stackLayers[layerIndex];
      const name = String(layer.key);
      const domClass = seriesDomClass("dual-stack", layerIndex);
      const color = colorScale(name) ?? fallbackColor;
      legendItems.push({ label: name, color, w: 10, h: 10 });
      const gradientFill = resolveSeriesGradientFill(defs, domClass, color, seriesGradient);
      plot
        .selectAll(seriesDomSelector("dual-stack", layerIndex))
        .data(layer)
        .join("g")
        .attr("class", domClass)
        .attr("transform", (d) => `translate(${(x(String(d.data.__category__)) ?? 0) - barWidth / 2},0)`)
        .attr("cursor", onPointClick ? "pointer" : "default")
        .each(function (d) {
          const y1 = yRight(Number(d[1]));
          const rawH = Math.max(0, yRight(Number(d[0])) - y1);
          const h = rawH > STACK_GAP ? rawH - STACK_GAP : rawH;
          const val = Number(d[1]) - Number(d[0]);
          const solid = gradientFill.startsWith("url(") ? color : resolveDatumColor(val, color, conditionalRules);
          const front = gradientFill.startsWith("url(") ? gradientFill : solid;
          paintDualVBarCell(d3.select(this), { y1, h, w: barWidth, front, solid, rx: barRx });
        })
        .on("click", (_event, d) =>
          onPointClick?.({
            __category__: d.data.__category__,
            __value__: Number(d[1]) - Number(d[0]),
            __series__: name,
          }),
        );
    }
  } else if (useGrouped && hasMultiSeries) {
    const groupWidth = barWidth / seriesNames.length;
    seriesGroups.forEach((s, i) => {
      const name = s.name || "value";
      const domClass = seriesDomClass("dual-group", i);
      const color = colorScale(name) ?? fallbackColor;
      legendItems.push({ label: name, color, w: 10, h: 10 });
      const cellW = Math.max(2, groupWidth * 0.9);
      const gradientFill = resolveSeriesGradientFill(defs, domClass, color, seriesGradient);
      plot
        .selectAll(seriesDomSelector("dual-group", i))
        .data(s.points)
        .join("g")
        .attr("class", domClass)
        .attr("transform", (d) => {
          const cx = x(String(d.__category__)) ?? 0;
          return `translate(${cx - barWidth / 2 + i * groupWidth},0)`;
        })
        .attr("cursor", onPointClick ? "pointer" : "default")
        .each(function (d) {
          const y1 = yRight(Number(d.__value__));
          const solid = gradientFill.startsWith("url(")
            ? color
            : resolveDatumColor(Number(d.__value__), color, conditionalRules);
          const front = gradientFill.startsWith("url(") ? gradientFill : solid;
          paintDualVBarCell(d3.select(this), { y1, h: innerH - y1, w: cellW, front, solid, rx: barRx });
        })
        .on("click", (_event, d) => onPointClick?.(d));
    });
  } else {
    legendItems.push({ label: "", color: fallbackColor, w: 10, h: 10 });
    const gradientFill = resolveSeriesGradientFill(defs, "dual-col", fallbackColor, seriesGradient);
    plot
      .selectAll("g.dual-col")
      .data(normalized)
      .join("g")
      .attr("class", "dual-col")
      .attr("transform", (d) => `translate(${(x(String(d.__category__)) ?? 0) - barWidth / 2},0)`)
      .attr("cursor", onPointClick ? "pointer" : "default")
      .each(function (d) {
        const y1 = yRight(Number(d.__value__));
        const solid = gradientFill.startsWith("url(")
          ? fallbackColor
          : resolveDatumColor(Number(d.__value__), fallbackColor, conditionalRules);
        const front = gradientFill.startsWith("url(") ? gradientFill : solid;
        paintDualVBarCell(d3.select(this), { y1, h: innerH - y1, w: barWidth, front, solid, rx: barRx });
      })
      .on("click", (_event, d) => onPointClick?.(d));
  }

  return { columnMax, legendItems };
}

export function columnTooltipRows(
  columnData: D3CartesianDatum[],
  xField: string,
  columnYField: string,
  columnSeriesField: string | undefined,
  category: string,
  colors: string[],
  fallbackColor: string,
  colorOffset = 0,
): Array<{ name: string; color: string; value: number }> {
  const normalized = normalizeCartesianData(columnData, xField, columnYField, columnSeriesField);
  const groups = groupSeries(normalized, columnSeriesField);
  if (groups.length > 1 && columnSeriesField) {
    const colorScale = d3
      .scaleOrdinal<string>()
      .domain(groups.map((g) => g.name))
      .range(groups.map((_, index) => seriesColorAt(colors, colorOffset + index, fallbackColor)));
    return groups.map((s) => {
      const pt = s.points.find((p) => String(p.__category__) === category);
      return {
        name: s.name || "柱",
        color: colorScale(s.name) ?? fallbackColor,
        value: Number(pt?.__value__ ?? 0),
      };
    });
  }
  const pt = normalized.find((p) => String(p.__category__) === category);
  return [{ name: "柱", color: fallbackColor, value: Number(pt?.__value__ ?? 0) }];
}
