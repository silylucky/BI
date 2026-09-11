import { describe, expect, it } from "vitest";
import { buildLiveSummaryMetrics } from "./components/standardAnalysisUi";

describe("buildLiveSummaryMetrics", () => {
  it("uses chart-aligned stats for time-series themes", () => {
    const rows = [
      ["2025-04-05", 2],
      ["2025-04-06", 3],
      ["2025-04-07", 1],
    ];
    const metrics = buildLiveSummaryMetrics(["d", "cnt"], rows, "trend", {
      sourceRowCount: 106,
      aggregatedPointCount: 90,
    });

    expect(metrics.map((item) => item.label)).toEqual(["时间点", "累计总量", "单日最高"]);
    expect(metrics[0]?.value).toBe("90");
    expect(metrics[1]?.value).toBe("6");
    expect(metrics[2]?.value).toBe("3");
    expect(metrics[1]?.hint).toContain("折线末端");
  });

  it("uses dimension stats for distribution theme", () => {
    const rows = [
      ["华东", 10],
      ["华北", 30],
    ];
    const metrics = buildLiveSummaryMetrics(["region", "cnt"], rows, "distribution", {
      sourceRowCount: 40,
      aggregatedPointCount: 2,
    });

    expect(metrics.map((item) => item.label)).toEqual(["区域数", "记录总数", "最高区域"]);
    expect(metrics[2]?.value).toBe("华北（30）");
  });
});
