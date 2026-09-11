import { describe, expect, it } from "vitest";
import { defaultChartConfig } from "@/components/dashboard/layoutUtils";
import { readChartDeStyle, readChartShowLabel, readChartLegendVisible } from "@/lib/chartDeStyle";
import { DEFAULT_PIE_CHART_DE_STYLE } from "@/lib/defaultPieChartDeStyle";

describe("defaultPieChartDeStyle", () => {
  it("applies pie defaults to new pie charts", () => {
    const cfg = defaultChartConfig("pie");
    const deStyle = readChartDeStyle(cfg);
    expect(deStyle.pie).toEqual(DEFAULT_PIE_CHART_DE_STYLE.pie);
    expect(deStyle.label).toEqual(DEFAULT_PIE_CHART_DE_STYLE.label);
    expect(readChartShowLabel(cfg)).toBe(true);
    expect(readChartLegendVisible(cfg)).toBe(true);
    expect(deStyle.legend?.position).toBe("bottom");
  });

  it("applies inner radius default for donut variants", () => {
    const cfg = defaultChartConfig("pie-donut");
    expect(readChartDeStyle(cfg).pie?.innerRadiusPercent).toBe(40);
  });
});
