import { expect } from "vitest";
import type { ChartRenderPlan } from "@/components/charts/engine/buildChartRenderPlan";
import type { ChartCatalogSmokeCase } from "./chartCatalogSmokeFixtures";

function colIndex(columns: string[], field: string): number {
  return columns.indexOf(field);
}

function pieAggregates(item: ChartCatalogSmokeCase): Array<{ type: string; value: number }> {
  const dim = item.dimensions[0]?.field ?? "";
  const metric = item.metrics[0]?.field ?? "";
  const di = colIndex(item.columns, dim);
  const mi = colIndex(item.columns, metric);
  const totals = new Map<string, number>();
  for (const row of item.rows) {
    const key = String(row[di] ?? "");
    totals.set(key, (totals.get(key) ?? 0) + Number(row[mi] ?? 0));
  }
  return [...totals.entries()].map(([type, value]) => ({ type, value }));
}

const CARTESIAN_TYPES = new Set([
  "line",
  "area",
  "area-stack",
  "bar",
  "bar-stack",
  "percentage-bar-stack",
  "bar-group",
  "bar-group-stack",
  "bar-horizontal",
  "bar-stack-horizontal",
  "percentage-bar-stack-horizontal",
]);

const PIE_TYPES = new Set([
  "pie",
  "pie-donut",
  "pie-rose",
  "pie-donut-rose",
  "radar",
  "waterfall",
]);

const HIERARCHY_TYPES = new Set(["treemap", "circle-packing", "word-cloud"]);

/** L2 DATA：plan 编码结果与夹具行值一致 */
export function assertPlanMatchesFixture(item: ChartCatalogSmokeCase, plan: ChartRenderPlan): void {
  expect(plan.kind).toBe("d3");
  expect(plan.empty).not.toBe(true);

  const { type } = item;

  if (type === "gauge") {
    const mi = colIndex(item.columns, item.metrics[0]!.field);
    const raw = Number(item.rows[0]?.[mi] ?? 0);
    expect(plan.options.rawValue).toBe(raw);
    expect(plan.options.percent).toBeCloseTo(raw > 1 && raw <= 100 ? raw / 100 : raw);
    return;
  }

  if (type === "liquid") {
    const mi = colIndex(item.columns, item.metrics[0]!.field);
    const raw = Number(item.rows[0]?.[mi] ?? 0);
    expect(plan.options.rawValue).toBeCloseTo(raw);
    return;
  }

  if (type === "kpi") {
    expect(plan.options.rows).toEqual(item.rows);
    expect(plan.options.columns).toEqual(item.columns);
    return;
  }

  if (type.startsWith("table-") || type === "table-info") {
    expect(plan.options.rows).toEqual(item.rows);
    expect(plan.options.columns).toEqual(item.columns);
    return;
  }

  if (type === "t-heatmap") {
    const data = plan.options.data as Array<{ x: string; y: string; value: number }>;
    expect(data).toHaveLength(item.rows.length);
    const xi = colIndex(item.columns, item.dimensions[0]!.field);
    const yi = colIndex(item.columns, item.dimensions[1]!.field);
    const mi = colIndex(item.columns, item.metrics[0]!.field);
    expect(data[0]).toMatchObject({
      x: String(item.rows[0]![xi]),
      y: String(item.rows[0]![yi]),
      value: Number(item.rows[0]![mi]),
    });
    return;
  }

  if (type === "map" || type === "map-3d") {
    expect(plan.options.rows).toEqual(item.rows);
    expect(plan.options.columns).toEqual(item.columns);
    expect(item.dimensions[0]?.field).toBeTruthy();
    const metricField = item.metrics[0]?.field;
    if (metricField) {
      expect(item.columns).toContain(metricField);
    }
    return;
  }

  if (type === "sankey") {
    const data = plan.options.data as Array<{ source: string; target: string; value: number }>;
    expect(data).toHaveLength(item.rows.length);
    const si = colIndex(item.columns, item.dimensions[0]!.field);
    const di = colIndex(item.columns, item.dimensions[1]!.field);
    const mi = colIndex(item.columns, item.metrics[0]!.field);
    expect(data[0]).toMatchObject({
      source: String(item.rows[0]![si]),
      target: String(item.rows[0]![di]),
      value: Number(item.rows[0]![mi]),
    });
    return;
  }

  if (type === "graph") {
    const edges = plan.options.edges as Array<{ source: string; target: string }>;
    expect(edges).toHaveLength(item.rows.length);
    const si = colIndex(item.columns, item.dimensions[0]!.field);
    const di = colIndex(item.columns, item.dimensions[1]!.field);
    expect(edges[0]).toMatchObject({
      source: String(item.rows[0]![si]),
      target: String(item.rows[0]![di]),
    });
    return;
  }

  if (type === "funnel") {
    const data = plan.options.data as Array<{ stage: string; number: number }>;
    const expected = pieAggregates(item).map((d) => ({ stage: d.type, number: d.value }));
    expect(data).toEqual(expected);
    return;
  }

  if (PIE_TYPES.has(type)) {
    const data = plan.options.data as Array<{ type: string; value: number }>;
    expect(data).toEqual(pieAggregates(item));
    return;
  }

  if (HIERARCHY_TYPES.has(type)) {
    const data = plan.options.data as Array<{ name?: string; word?: string; value?: number; weight?: number }>;
    const expected = pieAggregates(item);
    if (type === "word-cloud") {
      expect(data).toEqual(expected.map((d) => ({ word: d.type, weight: d.value })));
    } else {
      expect(data).toEqual(expected.map((d) => ({ name: d.type, value: d.value })));
    }
    return;
  }

  if (type.startsWith("chart-mix")) {
    const series = plan.options.data as unknown[];
    expect(Array.isArray(series)).toBe(true);
    expect(series.length).toBe(2);
    for (const part of series) {
      expect(Array.isArray(part)).toBe(true);
      expect((part as unknown[]).length).toBeGreaterThan(0);
    }
    const lineLabels = plan.options.lineLabels as [string, string] | undefined;
    const colMetric = item.metrics[0]?.field ?? "";
    const lineMetric = item.metrics[1]?.field ?? "";
    if (type === "chart-mix-dual-line") {
      expect(lineLabels).toEqual([colMetric, lineMetric]);
    } else {
      expect(lineLabels).toEqual([colMetric, lineMetric]);
    }

    if (type === "chart-mix-stack") {
      expect(plan.options.columnSeriesField).toBe("__series__");
      const colGeom = (plan.options.geometryOptions as [{ geometry: string }, { isStack?: boolean }])[0];
      expect(colGeom?.isStack).toBe(true);
      const barData = series[0] as Array<Record<string, unknown>>;
      const stackNames = new Set(barData.map((r) => r.__series__));
      expect(stackNames.size).toBeGreaterThan(1);
    }
    if (type === "chart-mix-group") {
      expect(plan.options.columnSeriesField).toBe("__series__");
      const colGeom = (plan.options.geometryOptions as [{ geometry: string; isGroup?: boolean }, unknown])[0];
      expect(colGeom?.isGroup).toBe(true);
    }
    return;
  }

  if (CARTESIAN_TYPES.has(type)) {
    const data = plan.options.data as Array<Record<string, unknown>>;
    expect(data.length).toBeGreaterThan(0);
    const xField = plan.options.xField as string;
    const yField = plan.options.yField as string;
    expect(data[0]![xField]).toBeDefined();
    expect(data[0]![yField]).toBeDefined();
    if (type === "percentage-bar-stack" || type === "percentage-bar-stack-horizontal") {
      expect((plan.options as { isStack?: boolean }).isStack ?? plan.options.isStack).toBe(true);
    }
    if (
      type === "area-stack" ||
      type === "bar-stack" ||
      type === "bar-stack-horizontal" ||
      type === "bar-group-stack"
    ) {
      expect(plan.options.seriesField ?? plan.options.columnSeriesField).toBeTruthy();
    }
    return;
  }

  if (type === "scatter") {
    const data = plan.options.data as Array<{ x: number; y: number }>;
    expect(data.length).toBeGreaterThan(0);
    const yi = colIndex(item.columns, item.metrics[0]!.field);
    expect(data[0]!.y).toBe(Number(item.rows[0]![yi]));
    return;
  }

  if (type === "quadrant" || type === "multi-scatter") {
    const data = plan.options.data as Array<{ x: number; y: number }>;
    expect(data.length).toBeGreaterThan(0);
    const xField = type === "multi-scatter" ? item.metrics[1]!.field : item.metrics[0]!.field;
    const yField = type === "multi-scatter" ? item.metrics[0]!.field : item.metrics[1]!.field;
    const xMi = colIndex(item.columns, xField);
    const yMi = colIndex(item.columns, yField);
    expect(data[0]!.x).toBe(Number(item.rows[0]![xMi]));
    expect(data[0]!.y).toBe(Number(item.rows[0]![yMi]));
    return;
  }

  if (
    type === "bar-range" ||
    type === "progress-bar" ||
    type === "bullet-graph" ||
    type === "stock-line" ||
    type === "bidirectional-bar"
  ) {
    const data = plan.options.data as Array<Record<string, unknown>>;
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    if (type === "stock-line") {
      const row = data[0]!;
      const [openF, closeF, lowF, highF] = item.metrics.map((m) => m.field);
      expect(Number(row[openF!])).toBe(Number(item.rows[0]![colIndex(item.columns, openF!)]));
      expect(Number(row[closeF!])).toBe(Number(item.rows[0]![colIndex(item.columns, closeF!)]));
      expect(Number(row[lowF!])).toBe(Number(item.rows[0]![colIndex(item.columns, lowF!)]));
      expect(Number(row[highF!])).toBe(Number(item.rows[0]![colIndex(item.columns, highF!)]));
    }
    if (type === "bullet-graph") {
      const row = data[0]!;
      const [actual, target, range] = item.metrics.map((m) => m.field);
      expect(Number(row.actual ?? row[actual!])).toBe(Number(item.rows[0]![colIndex(item.columns, actual!)]));
      expect(Number(row.target ?? row[target!])).toBe(Number(item.rows[0]![colIndex(item.columns, target!)]));
      if (range) {
        expect(Number(row.rangeMax ?? row[range])).toBe(Number(item.rows[0]![colIndex(item.columns, range)]));
      }
    }
    if (type === "bar-range") {
      const row = data[0]!;
      const [startF, endF] = item.metrics.map((m) => m.field);
      expect(row[startF!]).toBeDefined();
      expect(row[endF!]).toBeDefined();
    }
    if (type === "bidirectional-bar") {
      const row = data[0]!;
      const [leftF, rightF] = item.metrics.map((m) => m.field);
      expect(row[leftF!]).toBeDefined();
      expect(row[rightF!]).toBeDefined();
    }
    return;
  }

  throw new Error(`L2 assertion missing for chartType=${type}`);
}
