import { describe, expect, it } from "vitest";
import { resolveComponentGapRuntime } from "./componentGapRuntime";
import {
  dashboardLayoutPersistRoundtrip,
  hydrateDashboardStyle,
  layoutForEditorAfterPersist,
  persistDashboardLayout,
  prepareLayoutForListPreview,
  resolveEffectiveDashboardStyle,
  syncPixelLayoutChartStyles,
} from "./stylePipeline";

const pixelLayout = {
  version: 2 as const,
  canvas: { width: 1440, height: 900 },
  widgets: [
    {
      id: "w1",
      type: "chart" as const,
      title: "销量趋势",
      order: 0,
      x: 0,
      y: 0,
      width: 1440,
      height: 280,
      chartConfig: {
        chartType: "line" as const,
        chartId: "w1",
        mode: "sql" as const,
        dataSourceId: "00000000-0000-4000-8000-000000000001",
        sql: "SELECT 1",
        dimensions: [{ field: "sale_date" }],
        metrics: [{ field: "amount" }],
      },
    },
    {
      id: "w2",
      type: "chart" as const,
      title: "饼图",
      order: 1,
      x: 0,
      y: 300,
      width: 480,
      height: 260,
      chartConfig: {
        chartType: "pie" as const,
        chartId: "w2",
        mode: "sql" as const,
        dataSourceId: "00000000-0000-4000-8000-000000000001",
        sql: "SELECT 1",
        dimensions: [{ field: "region" }],
        metrics: [{ field: "amount" }],
      },
    },
  ],
  globalFilters: [],
};

describe("stylePipeline", () => {
  it("hydrate legacy widgetGap keeps pixel shell at none before and after persist", () => {
    const live = hydrateDashboardStyle({ widgetGap: 8, colorScheme: "dark" });
    expect(resolveComponentGapRuntime(live, "pixel").shellPaddingPx).toBe(0);

    const { saved } = dashboardLayoutPersistRoundtrip(pixelLayout, live, true);
    const reloaded = hydrateDashboardStyle(saved.styleConfig);
    expect(resolveComponentGapRuntime(reloaded, "pixel").shellPaddingPx).toBe(0);
  });

  it("resolveEffective prefers liveStyle over stale layout.styleConfig", () => {
    const effective = resolveEffectiveDashboardStyle(
      {
        ...pixelLayout,
        styleConfig: { gapPreset: "none", widgetGap: 0, pixelGutter: 0 },
      },
      { gapPreset: "md", widgetGap: 8, pixelGutter: 5 },
    );
    expect(effective.gapPreset).toBe("md");
    expect(resolveComponentGapRuntime(effective, "pixel").shellPaddingPx).toBe(5);
  });

  it("persist roundtrip preserves widget geometry", () => {
    const style = hydrateDashboardStyle({ gapPreset: "md", colorScheme: "dark" });
    const { saved } = dashboardLayoutPersistRoundtrip(pixelLayout, style, true);
    expect(saved.widgets[0]).toMatchObject({ x: 0, y: 0, width: 1440, height: 280 });
    expect(saved.widgets[1]).toMatchObject({ x: 0, y: 300, width: 480, height: 260 });
  });

  it("persist none gap roundtrip yields zero pixel shell padding", () => {
    const style = hydrateDashboardStyle({
      gapPreset: "none",
      widgetGap: 0,
      pixelGutter: 0,
      colorScheme: "light",
    });
    const { saved } = dashboardLayoutPersistRoundtrip(pixelLayout, style, true);
    const reloaded = hydrateDashboardStyle(saved.styleConfig);
    expect(reloaded.gapPreset).toBe("none");
    expect(resolveComponentGapRuntime(reloaded, "pixel").shellPaddingPx).toBe(0);
    expect(resolveComponentGapRuntime(reloaded, "grid").shellPaddingPx).toBe(0);
  });

  it("syncPixelLayoutChartStyles keeps pixel geometry", () => {
    const synced = syncPixelLayoutChartStyles(
      { ...pixelLayout, styleConfig: { colorScheme: "dark" } },
      "dark",
    );
    expect(synced.widgets[0]).toMatchObject({ x: 0, y: 0, width: 1440, height: 280 });
    expect(synced.widgets[1]).toMatchObject({ x: 0, y: 300, width: 480, height: 260 });
  });

  it("prepareLayoutForListPreview migrates deprecated table chartType", () => {
    const prepared = prepareLayoutForListPreview({
      version: 1,
      widgets: [
        {
          id: "w1",
          type: "chart",
          title: "明细",
          order: 0,
          colSpan: 12,
          rowSpan: 4,
          chartConfig: {
            chartId: "w1",
            chartType: "table",
            mode: "sql",
            sql: "SELECT 1",
          },
        },
      ],
      globalFilters: [],
    });
    expect(prepared.widgets[0]?.chartConfig?.chartType).toBe("table-info");
  });

  it("normalizes legacy paletteOpacity percent to fraction on hydrate", () => {
    const style = hydrateDashboardStyle({ paletteOpacity: 85, colorScheme: "light" });
    expect(style.paletteOpacity).toBeCloseTo(0.85);
  });

  it("persist roundtrip keeps inline map manualDrillStack through save and reload", () => {
    const layout = {
      version: 2 as const,
      canvas: { width: 1440, height: 900 },
      widgets: [
        {
          id: "map-inline",
          type: "chart" as const,
          title: "区域地图",
          order: 0,
          x: 0,
          y: 0,
          width: 800,
          height: 600,
          chartConfig: {
            chartId: "map-inline",
            chartType: "map" as const,
            mode: "sql" as const,
            dataSourceId: "00000000-0000-4000-8000-000000000001",
            sql: "SELECT 1",
            dimensions: [{ field: "province" }],
            metrics: [{ field: "value" }],
            nativeBody: {
              deStyle: {
                geo: {
                  manualDrillStack: [
                    { field: "province", value: "内蒙古自治区", label: "内蒙古自治区" },
                  ],
                },
              },
            },
          },
        },
      ],
      globalFilters: [],
    };
    const style = hydrateDashboardStyle({ colorScheme: "dark" });
    const saved = persistDashboardLayout(layout, style);
    const reloaded = layoutForEditorAfterPersist(saved, saved.styleConfig ?? style);
    const chart = reloaded.widgets[0];
    expect(chart.type).toBe("chart");
    if (chart.type !== "chart" || !chart.chartConfig) throw new Error("expected chart widget");
    expect(chart.chartConfig.nativeBody?.deStyle?.geo?.manualDrillStack).toEqual([
      { field: "province", value: "内蒙古自治区", label: "内蒙古自治区" },
    ]);
  });
});
