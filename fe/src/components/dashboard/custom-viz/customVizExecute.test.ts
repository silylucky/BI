import { describe, expect, it } from "vitest";
import {
  customVizBindingToChartConfig,
  isCustomVizExecuteReady,
  resolveCustomVizStyle,
} from "./customVizExecute";
import type { CustomVizDataBinding } from "../layoutUtils";

describe("customVizExecute", () => {
  it("maps binding to synthetic table chart config without mutating layout chartType", () => {
    const binding: CustomVizDataBinding = {
      status: "connected",
      dataSourceId: "ds-1",
      datasetId: "set-1",
      configId: "cfg-1",
      dimensions: [{ field: "region" }],
      metrics: [{ field: "amount", agg: "sum" }],
      filters: [{ field: "region", operator: "eq", value: "华东" }],
      refreshMode: "30s",
      resultLimit: "500",
    };
    const cfg = customVizBindingToChartConfig(binding);
    expect(cfg.chartType).toBe("table");
    expect(cfg.dimensions).toEqual([{ field: "region" }]);
    expect(cfg.metrics).toEqual([{ field: "amount", agg: "sum" }]);
    expect(cfg.filters).toHaveLength(1);
    expect(isCustomVizExecuteReady(binding)).toBe(true);
  });

  it("is execute-ready for detail table with dimensions only", () => {
    expect(
      isCustomVizExecuteReady(
        {
          status: "connected",
          dataSourceId: "ds-1",
          datasetId: "set-1",
          configId: "cfg-1",
          dimensions: [{ field: "city" }, { field: "amount" }],
          metrics: [],
        },
        {
          dimensions: { min: 1, max: 6, label: "明细列" },
          metrics: { min: 0, max: 0, label: "数值列" },
        },
      ),
    ).toBe(true);
  });

  it("is execute-ready when manifest wrongly requires metrics but detail table columns are bound", () => {
    expect(
      isCustomVizExecuteReady(
        {
          status: "connected",
          dataSourceId: "ds-1",
          datasetId: "set-1",
          configId: "cfg-1",
          dimensions: [{ field: "flow_id" }, { field: "flow_name" }, { field: "status" }],
          metrics: [],
        },
        {
          dimensions: { min: 1, max: 6, label: "明细列" },
          metrics: { min: 1, max: 1, label: "数值列" },
        },
      ),
    ).toBe(true);
  });

  it("is not execute-ready when fields are empty", () => {
    expect(
      isCustomVizExecuteReady({
        status: "connected",
        dataSourceId: "ds-1",
        datasetId: "set-1",
        configId: "cfg-1",
        dimensions: [],
        metrics: [],
      }),
    ).toBe(false);
  });

  it("applies default result limit when binding omits resultLimit", () => {
    const cfg = customVizBindingToChartConfig({
      status: "connected",
      dataSourceId: "ds-1",
      datasetId: "set-1",
      configId: "cfg-1",
      dimensions: [{ field: "region" }],
      metrics: [{ field: "amount", agg: "sum" }],
    });
    expect(cfg.nativeBody?.deDisplay?.resultLimit).toBe("20");
  });

  it("merges manifest default style with layout overrides", () => {
    expect(
      resolveCustomVizStyle({ accentColor: "#111", barHeight: 12 }, { accentColor: "#222" }),
    ).toEqual({ accentColor: "#222", barHeight: 12 });
  });
});
