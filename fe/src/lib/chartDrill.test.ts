import { describe, expect, it } from "vitest";
import type { ChartViewConfig } from "@/lib/chartViewConfig";
import {
  applyChartDrillPipeline,
  canDrillDeeper,
  drillStackToFilterParameters,
  filterRowsByDrillStack,
  getActiveDisplayField,
  getClickDrillField,
  getDrillChain,
  isDrillEnabled,
  supportsChartDrillInteraction,
} from "./chartDrill";

function chartConfig(overrides: Partial<ChartViewConfig> = {}): ChartViewConfig {
  return {
    chartType: "bar",
    dataSourceId: "ds-1",
    sql: "select * from t",
    dimensions: [
      { field: "province", label: "省" },
      { field: "city", label: "市" },
      { field: "district", label: "区" },
    ],
    metrics: [{ field: "amount", label: "金额" }],
    ...overrides,
  };
}

describe("chartDrill", () => {
  it("builds drill chain from active dimensions up to 3 levels", () => {
    expect(getDrillChain(chartConfig())).toEqual(["province", "city", "district"]);
    expect(getDrillChain(chartConfig({ dimensions: [{ field: "a" }] }))).toEqual(["a"]);
    expect(isDrillEnabled(chartConfig({ dimensions: [{ field: "a" }] }))).toBe(false);
    expect(isDrillEnabled(chartConfig())).toBe(true);
  });

  it("filters rows by drill stack", () => {
    const columns = ["province", "city", "amount"];
    const rows = [
      ["浙江", "杭州", 10],
      ["浙江", "宁波", 20],
      ["江苏", "南京", 30],
    ];
    const filtered = filterRowsByDrillStack(rows, columns, [
      { field: "province", value: "浙江" },
    ]);
    expect(filtered).toHaveLength(2);
  });

  it("aggregates by active display field after drill", () => {
    const columns = ["province", "city", "amount"];
    const rows = [
      ["浙江", "杭州", 10],
      ["浙江", "宁波", 20],
    ];
    const result = applyChartDrillPipeline(
      chartConfig(),
      columns,
      rows,
      [{ field: "province", value: "浙江" }],
    );
    expect(result.displayField).toBe("city");
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual(["浙江", "杭州", 10]);
  });

  it("exposes click field only when deeper drill is available", () => {
    const config = chartConfig();
    expect(getClickDrillField(config, [])).toBe("province");
    expect(canDrillDeeper([], config)).toBe(true);
    expect(
      getClickDrillField(config, [{ field: "province", value: "浙江" }]),
    ).toBe("city");
    expect(
      getClickDrillField(config, [
        { field: "province", value: "浙江" },
        { field: "city", value: "杭州" },
      ]),
    ).toBeUndefined();
    expect(canDrillDeeper(
      [
        { field: "province", value: "浙江" },
        { field: "city", value: "杭州" },
      ],
      config,
    )).toBe(false);
  });

  it("maps drill stack to filter parameters", () => {
    expect(
      drillStackToFilterParameters([
        { field: "province", value: "浙江" },
        { field: "city", value: "杭州" },
      ]),
    ).toEqual({ province: "浙江", city: "杭州" });
  });

  it("supports drill on migrated table-info type", () => {
    expect(
      supportsChartDrillInteraction(
        chartConfig({
          chartType: "table-info" as ChartViewConfig["chartType"],
        }),
      ),
    ).toBe(true);
  });

  it("supports drill on bar-group via plugin category", () => {
    expect(
      supportsChartDrillInteraction(
        chartConfig({
          chartType: "bar-group" as ChartViewConfig["chartType"],
        }),
      ),
    ).toBe(true);
  });

  it("supports drill on map-3d even without explicit dimension slots", () => {
    expect(
      supportsChartDrillInteraction(
        chartConfig({
          chartType: "map-3d",
          dimensions: [],
        }),
      ),
    ).toBe(true);
  });

  it("uses first dimension at root level", () => {
    expect(getActiveDisplayField(chartConfig(), [])).toBe("province");
    expect(
      getActiveDisplayField(chartConfig(), [{ field: "province", value: "浙江" }]),
    ).toBe("city");
  });
});
