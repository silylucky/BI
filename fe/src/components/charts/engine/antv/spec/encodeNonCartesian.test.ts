import { describe, expect, it } from "vitest";
import { buildPlanForType } from "@/components/charts/engine/plugins/plans/buildPlan";
import { encodeCartesianRows } from "@/components/charts/engine/antv/spec/encodeCartesian";
import type { RenderSpec } from "@/components/charts/engine/types";
import type { ChartViewModel } from "@/components/charts/engine/types";

function vm(
  chartType: string,
  columns: string[],
  rows: unknown[][],
  dimensions: Array<{ field: string }>,
  metrics: Array<{ field: string }>,
): ChartViewModel {
  return {
    chartType,
    styleVariant: "default",
    engine: "antv",
    encoding: { dimensions, metrics },
    dataset: { rows, columns },
    source: {},
  };
}

describe("non-cartesian encoding (L3→L2)", () => {
  it("sankey: source/target/weight map to edge list", () => {
    const plan = buildPlanForType(
      "sankey",
      vm(
        "sankey",
        ["source", "target", "weight"],
        [
          ["A", "B", 10],
          ["B", "C", 5],
        ],
        [{ field: "source" }, { field: "target" }],
        [{ field: "weight" }],
      ),
    );
    const data = plan.options.data as Array<{ source: string; target: string; value: number }>;
    expect(data).toEqual([
      { source: "A", target: "B", value: 10 },
      { source: "B", target: "C", value: 5 },
    ]);
  });

  it("graph: source/target map to edges without metric", () => {
    const plan = buildPlanForType(
      "graph",
      vm("graph", ["source", "target"], [["X", "Y"]], [{ field: "source" }, { field: "target" }], []),
    );
    const edges = plan.options.edges as Array<{ source: string; target: string }>;
    expect(edges).toEqual([{ source: "X", target: "Y" }]);
  });

  it("stock-line: OHLC metrics map to four y fields", () => {
    const plan = buildPlanForType(
      "stock-line",
      vm(
        "stock-line",
        ["date", "open", "close", "low", "high"],
        [["2025-01-01", 10, 12, 9, 13]],
        [{ field: "date" }],
        [{ field: "open" }, { field: "close" }, { field: "low" }, { field: "high" }],
      ),
    );
    const data = plan.options.data as Array<Record<string, unknown>>;
    expect(data[0]).toMatchObject({ open: 10, close: 12, low: 9, high: 13 });
  });

  it("bullet-graph: actual/target/range metrics present in plan data", () => {
    const plan = buildPlanForType(
      "bullet-graph",
      vm(
        "bullet-graph",
        ["category", "actual", "target", "range"],
        [["Sales", 80, 100, 120]],
        [{ field: "category" }],
        [{ field: "actual" }, { field: "target" }, { field: "range" }],
      ),
    );
    const data = plan.options.data as Array<Record<string, unknown>>;
    expect(data[0]).toMatchObject({ actual: 80, target: 100, rangeMax: 120 });
  });

  it("chart-mix: column + line series from dual metrics", () => {
    const plan = buildPlanForType(
      "chart-mix",
      vm(
        "chart-mix",
        ["sale_date", "amount", "amount2"],
        [["2025-07-01", 100, 80]],
        [{ field: "sale_date" }],
        [{ field: "amount" }, { field: "amount2" }],
      ),
    );
    expect(plan.options.lineLabels).toEqual(["amount", "amount2"]);
    const series = plan.options.data as unknown[];
    expect(series).toHaveLength(2);
  });

  it("syncLegacyFieldsFromAxes: line subcategory splits series via encodeCartesianRows", () => {
    const spec: RenderSpec = {
      chartType: "line",
      styleVariant: "default",
      encoding: {
        dimensions: [{ field: "region" }, { field: "sale_date" }],
        metrics: [{ field: "amount" }],
      },
    };
    const enc = encodeCartesianRows(
      spec,
      [
        ["华东", "2025-01-05", 100],
        ["华北", "2025-01-05", 200],
        ["华东", "2025-02-15", 150],
        ["华北", "2025-02-15", 180],
      ],
      ["region", "sale_date", "amount"],
      "line",
    );
    expect(enc.seriesField).toBe("__series__");
    expect([...new Set(enc.data.map((d) => d.__series__))].sort()).toEqual([
      "2025-01-05",
      "2025-02-15",
    ]);
  });
});
