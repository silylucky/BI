import { describe, expect, it } from "vitest";
import {
  compareTimeSeriesKeys,
  lastCumulativeCount,
  prepareTrendChartRows,
  sortTimeSeriesRows,
} from "./standardAnalysisTimeSeries";

describe("standardAnalysisTimeSeries", () => {
  it("sorts ISO dates chronologically", () => {
    const rows = [
      ["2025-04-07", 1],
      ["2025-04-05", 2],
      ["2025-04-06", 3],
    ];
    expect(sortTimeSeriesRows(["d", "cnt"], rows)).toEqual([
      ["2025-04-05", 2],
      ["2025-04-06", 3],
      ["2025-04-07", 1],
    ]);
  });

  it("builds monotonic cumulative series for trend chart", () => {
    const rows = [
      ["2025-04-05", 2],
      ["2025-04-06", 3],
      ["2025-04-07", 1],
    ];
    expect(prepareTrendChartRows(["d", "cnt"], rows)).toEqual([
      ["2025-04-05", 2],
      ["2025-04-06", 5],
      ["2025-04-07", 6],
    ]);
    expect(lastCumulativeCount(["d", "cnt"], rows)).toBe(6);
  });

  it("compareTimeSeriesKeys handles week buckets", () => {
    expect(compareTimeSeriesKeys("2026-W02", "2026-W10")).toBeLessThan(0);
  });
});
