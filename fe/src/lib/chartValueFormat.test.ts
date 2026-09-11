import { describe, expect, it } from "vitest";
import { formatChartValue, mergePercentValueFormat } from "@/lib/chartValueFormat";

describe("chartValueFormat", () => {
  it("mergePercentValueFormat forces percent type for percentage charts", () => {
    const merged = mergePercentValueFormat({ type: "auto", decimals: 0 }, true);
    expect(formatChartValue(0.2, merged)).toBe("20%");
    expect(formatChartValue(1, merged)).toBe("100%");
  });
});
