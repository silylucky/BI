import { describe, expect, it } from "vitest";
import type { ChartViewConfig } from "@/lib/chartViewConfig";
import {
  buildCustomRefreshFromParts,
  CHART_RESULT_LIMIT_OPTIONS,
  dashboardQueryLimitSelectValue,
  formatResultLimitSelectValue,
  parseCustomRefreshParts,
  parseDeRefreshIntervalSec,
  parseDeResultLimit,
  patchChartDeDisplay,
  readChartDeDisplay,
  resolveChartQueryLimit,
  persistResultLimitSelection,
  resultLimitCustomAmount,
  selectValueToDashboardQueryLimit,
} from "@/lib/chartDeDisplay";

const baseCfg: ChartViewConfig = { chartType: "bar", dataSourceId: "ds-1" };

describe("chartDeDisplay", () => {
  it("T-DE-DISP-01: reads defaults when nativeBody missing", () => {
    expect(readChartDeDisplay(baseCfg)).toEqual({});
  });

  it("T-DE-DISP-02: patch merges deDisplay", () => {
    const next = patchChartDeDisplay(baseCfg, { resultLimit: "500" });
    expect(readChartDeDisplay(next).resultLimit).toBe("500");
  });

  it("T-DE-DISP-03: parses preset and custom refresh intervals", () => {
    expect(parseDeRefreshIntervalSec("30s")).toBe(30);
    expect(parseDeRefreshIntervalSec("custom:45")).toBe(45);
    expect(parseDeRefreshIntervalSec("custom:3")).toBe(5);
    expect(parseDeRefreshIntervalSec("custom:120")).toBe(120);
    expect(parseDeRefreshIntervalSec("off")).toBeNull();
  });

  it("T-DE-DISP-04: custom refresh supports minute parts", () => {
    expect(buildCustomRefreshFromParts(2, "m")).toBe("custom:120");
    expect(parseCustomRefreshParts("custom:120")).toEqual({ amount: 2, unit: "m" });
    expect(parseCustomRefreshParts("custom:45")).toEqual({ amount: 45, unit: "s" });
  });

  it("T-DE-DISP-05: result limit options exclude 10000 and 全部", () => {
    const values = CHART_RESULT_LIMIT_OPTIONS.map((opt) => opt.value);
    expect(values).toEqual(["10", "20", "50", "100", "500", "1000"]);
  });

  it("T-DE-DISP-07: non-preset result counts map to custom select", () => {
    expect(formatResultLimitSelectValue("600")).toBe("custom");
    expect(resultLimitCustomAmount("600")).toBe(600);
    expect(parseDeResultLimit("600")).toBe(600);
    expect(dashboardQueryLimitSelectValue(600)).toBe("custom");
    expect(formatResultLimitSelectValue(undefined)).toBe("20");
    expect(resolveChartQueryLimit(baseCfg, {})).toBe(20);
  });

  it("T-DE-DISP-09: new chart configs seed default resultLimit", async () => {
    const { defaultChartConfig } = await import("@/components/dashboard/layoutUtils");
    const cfg = defaultChartConfig("bar");
    expect(cfg.nativeBody?.deDisplay?.resultLimit).toBe("20");
    expect(cfg.nativeBody?.deStyle?.title?.show).toBe(true);
    expect(cfg.nativeBody?.deStyle?.label?.show).toBe(true);
  });

  it("T-DE-DISP-08: selecting custom from a preset stays custom", () => {
    expect(persistResultLimitSelection("custom", "1000")).toBe("custom:1000");
    expect(formatResultLimitSelectValue("custom:1000")).toBe("custom");
    expect(parseDeResultLimit("custom:1000")).toBe(1000);
    expect(parseDeResultLimit("custom:80")).toBe(80);
    expect(
      resolveChartQueryLimit(patchChartDeDisplay(baseCfg, { resultLimit: "custom:80" }), {}),
    ).toBe(80);
  });

  it("T-DE-DISP-06: legacy all/10000 coerce to latest 1000", () => {
    expect(parseDeResultLimit("all")).toBe(1000);
    expect(parseDeResultLimit("10000")).toBe(1000);
    expect(dashboardQueryLimitSelectValue(10000)).toBe("1000");
    expect(selectValueToDashboardQueryLimit("all")).toBe(1000);
    expect(
      resolveChartQueryLimit(patchChartDeDisplay(baseCfg, { resultLimit: "all" }), {}),
    ).toBe(1000);
  });
});
