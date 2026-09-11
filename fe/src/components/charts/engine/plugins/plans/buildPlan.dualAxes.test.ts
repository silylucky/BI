import { describe, expect, it } from "vitest";
import { buildPlanForType } from "./buildPlan";
import type { ChartViewModel } from "@/components/charts/engine/types";

function dualVm(
  chartType: string,
  rows: unknown[][],
  columns: string[],
  axes: ChartViewModel["encoding"]["axes"],
  dims: Array<{ field: string }>,
  metrics: Array<{ field: string }>,
): ChartViewModel {
  return {
    chartType,
    styleVariant: "default",
    engine: "antv",
    encoding: { dimensions: dims, metrics, axes },
    dataset: { rows, columns },
    source: {},
  };
}

describe("buildPlanForType dual axes DE slot mapping", () => {
  const rows = [
    ["2025-07-01", "华东", 100, 80],
    ["2025-07-02", "华北", 200, 120],
    ["2025-07-03", "华南", 150, 90],
  ];
  const columns = ["sale_date", "region", "amount", "amount2"];

  it("maps yAxis to left column and yAxisExt to right line (DataEase 左柱右线)", () => {
    const plan = buildPlanForType(
      "chart-mix",
      dualVm(
        "chart-mix",
        rows,
        columns,
        {
          xAxis: [{ field: "sale_date" }],
          yAxis: [{ field: "amount" }],
          extBubble: [{ field: "region" }],
          yAxisExt: [{ field: "amount2" }],
        },
        [{ field: "sale_date" }, { field: "region" }],
        [{ field: "amount" }, { field: "amount2" }],
      ),
    );
    expect(plan.plotType).toBe("DualAxes");
    expect(plan.options.lineLabels).toEqual(["amount", "amount2"]);
    const geom = plan.options.geometryOptions as [{ geometry: string }, { geometry: string }];
    expect(geom[0]?.geometry).toBe("column");
    expect(geom[1]?.geometry).toBe("line");
    const data = plan.options.data as [
      Array<{ __category__: string; __value__: number; __series__?: string }>,
      Array<{ __category__: string; __value__: number; __series__?: string }>,
    ];
    expect(data[0]!.some((d) => d.__series__ === "华东")).toBe(false);
    expect(data[0]![0]).toMatchObject({ __category__: "2025-07-01", __value__: 100 });
    expect(data[1]!.some((d) => d.__series__ === "华东")).toBe(true);
    expect(data[1]![0]).toMatchObject({ __category__: "2025-07-01", __value__: 80 });
  });

  it("passes columnSeriesField for stack mode via extStack", () => {
    const plan = buildPlanForType(
      "chart-mix-stack",
      dualVm(
        "chart-mix-stack",
        rows,
        columns,
        {
          xAxis: [{ field: "sale_date" }],
          yAxis: [{ field: "amount" }],
          extStack: [{ field: "region" }],
          yAxisExt: [{ field: "amount2" }],
        },
        [{ field: "sale_date" }, { field: "region" }],
        [{ field: "amount" }, { field: "amount2" }],
      ),
    );
    expect(plan.options.columnSeriesField).toBe("__series__");
    const geom = plan.options.geometryOptions as [{ geometry: string; isStack?: boolean }, unknown];
    expect(geom[0]?.isStack).toBe(true);
  });

  it("ignores extStack when it duplicates category axis and passes line series field", () => {
    const plan = buildPlanForType(
      "chart-mix-stack",
      dualVm(
        "chart-mix-stack",
        rows,
        columns,
        {
          xAxis: [{ field: "sale_date" }],
          extStack: [{ field: "sale_date" }],
          yAxis: [{ field: "amount" }],
          extBubble: [{ field: "region" }],
          yAxisExt: [{ field: "amount2" }],
        },
        [{ field: "sale_date" }, { field: "region" }],
        [{ field: "amount" }, { field: "amount2" }],
      ),
    );
    expect(plan.options.columnSeriesField).toBeUndefined();
    expect(plan.options.lineSeriesField).toBe("__series__");
    const data = plan.options.data as [
      Array<{ __category__: string; __value__: number; __series__?: string }>,
      Array<{ __category__: string; __value__: number; __series__?: string }>,
    ];
    expect(data[0]!.some((d) => d.__series__ === "华东")).toBe(false);
    expect(data[1]!.some((d) => d.__series__ === "华东")).toBe(true);
  });

  it("passes columnSeriesField for group mode via xAxisExt", () => {
    const plan = buildPlanForType(
      "chart-mix-group",
      dualVm(
        "chart-mix-group",
        rows,
        columns,
        {
          xAxis: [{ field: "sale_date" }],
          xAxisExt: [{ field: "region" }],
          yAxis: [{ field: "amount" }],
          yAxisExt: [{ field: "amount2" }],
        },
        [{ field: "sale_date" }, { field: "region" }],
        [{ field: "amount" }, { field: "amount2" }],
      ),
    );
    expect(plan.options.columnSeriesField).toBe("__series__");
    const geom = plan.options.geometryOptions as [{ geometry: string; isGroup?: boolean }, unknown];
    expect(geom[0]?.isGroup).toBe(true);
  });

  it("renders bar-only when yAxisExt is empty (no duplicate line from legacy metrics)", () => {
    const plan = buildPlanForType(
      "chart-mix",
      dualVm(
        "chart-mix",
        rows,
        columns,
        {
          xAxis: [{ field: "sale_date" }],
          yAxis: [{ field: "amount" }],
        },
        [{ field: "sale_date" }],
        [{ field: "amount" }, { field: "amount2" }],
      ),
    );
    expect(plan.options.lineLabels).toEqual(["amount"]);
    const data = plan.options.data as [unknown[], unknown[]];
    expect(data[1]).toEqual([]);
  });

  it("renders line-only when yAxis is empty and yAxisExt has metric", () => {
    const plan = buildPlanForType(
      "chart-mix",
      dualVm(
        "chart-mix",
        rows,
        columns,
        {
          xAxis: [{ field: "sale_date" }],
          yAxisExt: [{ field: "amount2" }],
        },
        [{ field: "sale_date" }],
        [{ field: "amount2" }],
      ),
    );
    expect(plan.options.lineLabels).toEqual(["amount2"]);
    const data = plan.options.data as [unknown[], Array<{ __value__: number }>];
    expect(data[0]).toEqual([]);
    expect(data[1]!.length).toBeGreaterThan(0);
  });

  it("aggregates dual-line on category axis with left/right sub dims", () => {
    const plan = buildPlanForType(
      "chart-mix-dual-line",
      dualVm(
        "chart-mix-dual-line",
        rows,
        columns,
        {
          xAxis: [{ field: "sale_date" }],
          xAxisExt: [{ field: "region" }],
          yAxis: [{ field: "amount" }],
          yAxisExt: [{ field: "amount2" }],
        },
        [{ field: "sale_date" }, { field: "region" }],
        [{ field: "amount" }, { field: "amount2" }],
      ),
    );
    const data = plan.options.data as [
      Array<{ __category__: string; __series__?: string }>,
      Array<{ __category__: string }>,
    ];
    expect(data[0]!.length).toBeGreaterThan(3);
    expect(data[0]!.some((d) => d.__series__ === "华东")).toBe(true);
    expect(data[1]!.length).toBe(3);
  });

  it("province quantity amount without spurious sub-series when extBubble empty", () => {
    const provinceRows = [
      ["华东", 100, 10000],
      ["华北", 200, 15000],
      ["华南", 150, 12000],
    ];
    const provinceColumns = ["province", "quantity", "amount"];
    const plan = buildPlanForType(
      "chart-mix",
      dualVm(
        "chart-mix",
        provinceRows,
        provinceColumns,
        {
          xAxis: [{ field: "province" }],
          yAxis: [{ field: "quantity" }],
          yAxisExt: [{ field: "amount" }],
        },
        [{ field: "province" }],
        [{ field: "quantity" }, { field: "amount" }],
      ),
    );
    expect(plan.options.lineLabels).toEqual(["quantity", "amount"]);
    expect(plan.options.columnSeriesField).toBeUndefined();
    expect(plan.options.lineSeriesField).toBeUndefined();
    const data = plan.options.data as [
      Array<{ __category__: string; __value__: number }>,
      Array<{ __category__: string; __value__: number }>,
    ];
    expect(data[0]!.length).toBe(3);
    expect(data[1]!.length).toBe(3);
    expect(data[0]![0]).toMatchObject({ __category__: "华东", __value__: 100 });
    expect(data[1]![0]).toMatchObject({ __category__: "华东", __value__: 10000 });
  });

  it("ignores drill dimension when extBubble axis is empty (DE 右子类别)", () => {
    const provinceRows = [
      ["华东", "2025-07-01", 100, 10000],
      ["华北", "2025-07-02", 200, 15000],
    ];
    const provinceColumns = ["province", "sale_date", "quantity", "amount"];
    const plan = buildPlanForType(
      "chart-mix",
      dualVm(
        "chart-mix",
        provinceRows,
        provinceColumns,
        {
          xAxis: [{ field: "province" }],
          yAxis: [{ field: "quantity" }],
          yAxisExt: [{ field: "amount" }],
          drill: [{ field: "sale_date" }],
        },
        [{ field: "province" }, { field: "sale_date" }],
        [{ field: "quantity" }, { field: "amount" }],
      ),
    );
    expect(plan.options.lineSeriesField).toBeUndefined();
    expect(plan.options.columnSeriesField).toBeUndefined();
  });

  it("ignores empty xAxisExt in group mode and does not fall back to drill dim", () => {
    const plan = buildPlanForType(
      "chart-mix-group",
      dualVm(
        "chart-mix-group",
        rows,
        columns,
        {
          xAxis: [{ field: "sale_date" }],
          yAxis: [{ field: "amount" }],
          yAxisExt: [{ field: "amount2" }],
          drill: [{ field: "region" }],
        },
        [{ field: "sale_date" }, { field: "region" }],
        [{ field: "amount" }, { field: "amount2" }],
      ),
    );
    expect(plan.options.columnSeriesField).toBeUndefined();
  });
});
