import { describe, expect, it } from "vitest";
import { resolveRenderSpec } from "./resolveRenderSpec";
import type { ChartViewConfig } from "./chartViewConfig";

describe("resolveRenderSpec", () => {
  it("mirrors backend encoding and source for sql mode", () => {
    const config: ChartViewConfig = {
      chartType: "funnel",
      dataSourceId: "00000000-0000-4000-8000-000000000001",
      mode: "sql",
      sql: "SELECT 1",
      dimensions: [{ field: "stage" }],
      metrics: [{ field: "value" }],
      styleVariant: "default",
    };
    expect(resolveRenderSpec(config)).toEqual({
      engine: "antv",
      chartType: "funnel",
      styleVariant: "default",
      encoding: {
        dimensions: [{ field: "stage" }],
        metrics: [{ field: "value" }],
      },
      source: {
        mode: "sql",
        dataSourceId: "00000000-0000-4000-8000-000000000001",
        sql: "SELECT 1",
      },
    });
  });

  it("uses bindingId source when present", () => {
    const config: ChartViewConfig = {
      chartType: "line",
      bindingId: "bind-1",
      dimensions: [{ field: "x" }],
      metrics: [{ field: "y" }],
    };
    expect(resolveRenderSpec(config).source).toEqual({ bindingId: "bind-1" });
  });
});
