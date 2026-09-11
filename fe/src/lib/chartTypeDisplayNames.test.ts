import { describe, expect, it } from "vitest";
import {
  resolveChartWidgetTitle,
  shouldSyncWidgetTitleOnChartTypeChange,
} from "./chartTypeDisplayNames";

describe("chartTypeDisplayNames", () => {
  it("resolveChartWidgetTitle maps slug titles to Chinese", () => {
    expect(resolveChartWidgetTitle("chart-mix-dual-line", "chart-mix-dual-line")).toBe(
      "双线组合图",
    );
    expect(resolveChartWidgetTitle("table-normal", "table-normal")).toBe("汇总表");
  });

  it("resolveChartWidgetTitle keeps custom titles", () => {
    expect(resolveChartWidgetTitle("销售趋势", "line")).toBe("销售趋势");
  });

  it("resolveChartWidgetTitle defaults empty title from chartType", () => {
    expect(resolveChartWidgetTitle("", "bar")).toBe("基础柱状图");
  });

  it("shouldSyncWidgetTitleOnChartTypeChange detects auto titles", () => {
    expect(shouldSyncWidgetTitleOnChartTypeChange("chart-mix-dual-line", "chart-mix-dual-line")).toBe(
      true,
    );
    expect(shouldSyncWidgetTitleOnChartTypeChange("双线组合图", "chart-mix-dual-line")).toBe(true);
    expect(shouldSyncWidgetTitleOnChartTypeChange("销售趋势", "line")).toBe(false);
  });
});
