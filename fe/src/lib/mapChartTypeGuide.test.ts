import { describe, expect, it } from "vitest";
import { resolveMapChartTypeGuide } from "@/lib/mapChartTypeGuide";

describe("resolveMapChartTypeGuide", () => {
  it("suggests GIS when only coordinate columns exist", () => {
    expect(resolveMapChartTypeGuide(["lng", "lat", "amount"])).toContain("GIS");
  });

  it("suggests choropleth map when only geo name columns exist", () => {
    expect(resolveMapChartTypeGuide(["province", "city", "amount"])).toContain("区域地图");
  });

  it("returns null when columns are ambiguous or empty", () => {
    expect(resolveMapChartTypeGuide([])).toBeNull();
    expect(resolveMapChartTypeGuide(["amount", "channel"])).toBeNull();
  });
});
