import { describe, expect, it } from "vitest";
import {
  isCartesianRowCountExceeded,
  resolveCartesianRowLimit,
  sliceCartesianDisplayRows,
} from "@/lib/cartesianRowLimit";
import { CHART_EXECUTE_LIMIT } from "@/lib/chartExecuteProbe";

describe("cartesianRowLimit", () => {
  it("defaults to CHART_EXECUTE_LIMIT when queryLimit omitted", () => {
    expect(resolveCartesianRowLimit()).toBe(CHART_EXECUTE_LIMIT);
  });

  it("uses queryLimit when provided", () => {
    expect(resolveCartesianRowLimit(1000)).toBe(1000);
  });

  it("does not reject line chart within queryLimit", () => {
    expect(isCartesianRowCountExceeded("line", 150, 1000)).toBe(false);
  });

  it("rejects line chart above default limit", () => {
    expect(isCartesianRowCountExceeded("line", CHART_EXECUTE_LIMIT + 1)).toBe(true);
  });

  it("ignores non-cartesian chart types", () => {
    expect(isCartesianRowCountExceeded("pie", 500)).toBe(false);
  });

  it("slices line/bar rows to queryLimit instead of dropping the chart", () => {
    const rows = Array.from({ length: 20 }, (_, i) => [i]);
    expect(sliceCartesianDisplayRows("bar", rows, 11)).toHaveLength(11);
    expect(sliceCartesianDisplayRows("bar", rows, 1)).toHaveLength(1);
    expect(sliceCartesianDisplayRows("pie", rows, 1)).toHaveLength(20);
  });
});
