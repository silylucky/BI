import * as d3 from "d3";
import type { D3CartesianDatum } from "@/components/charts/engine/d3/types";
import type { ChartConditionalRule } from "@/lib/chartDeFeatures";
import { matchConditionalRule } from "@/lib/chartDeFeatures";

export type SeriesGroup = { name: string; points: D3CartesianDatum[] };

/** 宽表/stack 用列名；无系列字段时与 row[s.name||"value"] 对齐 */
export function seriesDataKey(name: string): string {
  return name || "value";
}

/** 系列索引 DOM class（展示名可能含括号等 CSS 非法字符） */
export function seriesDomClass(prefix: string, index: number): string {
  return `${prefix}-s${index}`;
}

export function seriesDomSelector(prefix: string, index: number): string {
  return `g.${seriesDomClass(prefix, index)}`;
}

export function resolveSeriesKeys(seriesNames: string[]): string[] {
  if (seriesNames.length === 0) return ["value"];
  return seriesNames.map(seriesDataKey);
}

export function groupSeries(
  data: D3CartesianDatum[],
  seriesField?: string,
  defaultSeriesName = "value",
): SeriesGroup[] {
  if (!seriesField) return [{ name: defaultSeriesName, points: data }];
  const map = d3.group(data, (d) => String(d[seriesField] ?? ""));
  return [...map.entries()].map(([name, points]) => ({ name, points }));
}

export function normalizeCartesianData(
  data: D3CartesianDatum[],
  xField: string,
  yField: string,
  seriesField?: string,
): D3CartesianDatum[] {
  return data.map((row) => ({
    ...row,
    __category__: row[xField],
    __value__: Number(row[yField] ?? 0),
    __series__: seriesField ? String(row[seriesField] ?? "") : "",
  }));
}

export function resolveDatumColor(
  value: number,
  baseColor: string,
  rules: ChartConditionalRule[],
): string {
  const active = rules.filter((rule) => rule.enabled && Number.isFinite(rule.value));
  const matched = active.find((rule) => matchConditionalRule(value, rule));
  return matched?.color ?? baseColor;
}

export function hasActiveConditionalRules(rules: ChartConditionalRule[]): boolean {
  return rules.some((rule) => rule.enabled && Number.isFinite(rule.value));
}

/** 折线按相邻点度量分段着色（条件样式） */
export function paintConditionalLineSegments(params: {
  plot: d3.Selection<SVGGElement, unknown, null, undefined>;
  points: D3CartesianDatum[];
  lineGen: d3.Line<D3CartesianDatum>;
  baseColor: string;
  conditionalRules: ChartConditionalRule[];
  strokeWidth?: number;
  strokeLinecap?: string;
  strokeOpacity?: number;
}): void {
  const { points, lineGen, baseColor, conditionalRules } = params;
  if (!hasActiveConditionalRules(conditionalRules) || points.length < 2) return;
  const strokeWidth = params.strokeWidth ?? 2;
  for (let i = 0; i < points.length - 1; i += 1) {
    const segment = [points[i], points[i + 1]];
    const value = Number(points[i + 1].__value__);
    const color = resolveDatumColor(value, baseColor, conditionalRules);
    params.plot
      .append("path")
      .datum(segment)
      .attr("fill", "none")
      .attr("stroke", color)
      .attr("stroke-width", strokeWidth)
      .attr("stroke-opacity", params.strokeOpacity ?? 1)
      .attr("stroke-linecap", params.strokeLinecap ?? "round")
      .attr("d", lineGen);
  }
}
