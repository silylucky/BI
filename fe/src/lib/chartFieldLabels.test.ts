import { describe, expect, it } from "vitest";
import {
  humanizeChartFieldName,
  resolveChartFieldLabel,
  resolveEncodingFieldLabel,
} from "@/lib/chartFieldLabels";
import type { ChartViewConfig } from "@/lib/chartViewConfig";

describe("chartFieldLabels", () => {
  it("humanizes common BI column names", () => {
    expect(humanizeChartFieldName("grid_name")).toBe("网格名称");
    expect(humanizeChartFieldName("event_count")).toBe("事件数");
    expect(humanizeChartFieldName("region")).toBe("区域");
  });

  it("resolveChartFieldLabel prefers explicit axis label", () => {
    const cfg = {
      chartType: "table-info",
      axes: { xAxis: [{ field: "grid_name", label: "自定义网格" }] },
    } as ChartViewConfig;
    expect(resolveChartFieldLabel(cfg, "grid_name")).toBe("自定义网格");
  });

  it("resolveEncodingFieldLabel humanizes xAxis-only table-info fields", () => {
    expect(
      resolveEncodingFieldLabel(
        {
          axes: { xAxis: [{ field: "event_count" }, { field: "grid_name" }] },
          dimensions: [],
          metrics: [],
        },
        "event_count",
      ),
    ).toBe("事件数");
  });
});
