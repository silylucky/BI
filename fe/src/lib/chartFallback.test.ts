import { describe, expect, it } from "vitest";
import { getFallbackChartType } from "./chartFallback";

describe("getFallbackChartType", () => {
  it("returns known type unchanged", () => {
    expect(getFallbackChartType("line")).toBe("line");
  });

  it("falls back unknown types to table-info", () => {
    expect(getFallbackChartType("unknown_xyz")).toBe("table-info");
  });
});
