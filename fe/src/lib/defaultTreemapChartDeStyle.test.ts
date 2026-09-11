import { describe, expect, it } from "vitest";
import { defaultChartConfig } from "@/components/dashboard/layoutUtils";
import { readChartDeStyle, readChartShowLabel } from "@/lib/chartDeStyle";
import { DEFAULT_TREEMAP_CHART_DE_STYLE } from "@/lib/defaultTreemapChartDeStyle";

describe("defaultTreemapChartDeStyle", () => {
  it("applies treemap defaults to new treemap charts", () => {
    const cfg = defaultChartConfig("treemap");
    const deStyle = readChartDeStyle(cfg);
    expect(deStyle.treemap).toEqual(DEFAULT_TREEMAP_CHART_DE_STYLE.treemap);
    expect(deStyle.label).toEqual(DEFAULT_TREEMAP_CHART_DE_STYLE.label);
    expect(readChartShowLabel(cfg)).toBe(true);
  });
});
