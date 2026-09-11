import { describe, expect, it } from "vitest";
import {
  buildDataScreenLayoutFromTemplate,
  exportDataScreenTemplate,
  parseImportedDataScreenLayout,
} from "./dataScreenTemplates";
import { isScreenClockWidget } from "./screenVisualAssets";

describe("dataScreenTemplates", () => {
  it("command-center template includes L1 slots and chart placeholders", () => {
    const layout = buildDataScreenLayoutFromTemplate("command-center");
    expect(layout.widgets.length).toBeGreaterThanOrEqual(10);
    expect(layout.widgets.filter((w) => w.type === "chart").length).toBe(3);
  });

  it("tech-blue template includes clock and border widgets", () => {
    const layout = buildDataScreenLayoutFromTemplate("tech-blue");
    expect(layout.version).toBe(2);
    expect(layout.canvas).toEqual({ width: 1920, height: 1080 });
    expect(layout.styleConfig?.surfaceKind).toBe("data-screen");
    expect(layout.widgets.some(isScreenClockWidget)).toBe(true);
    expect(layout.widgets.length).toBeGreaterThanOrEqual(3);
  });

  it("parseImportedDataScreenLayout normalizes surface kind", () => {
    const layout = parseImportedDataScreenLayout({
      version: 2,
      canvas: { width: 1920, height: 1080 },
      widgets: [],
      globalFilters: [],
      styleConfig: { colorScheme: "dark" },
    });
    expect(layout.styleConfig?.surfaceKind).toBe("data-screen");
  });

  it("rejects non-v2 layout", () => {
    expect(() =>
      parseImportedDataScreenLayout({ version: 1, widgets: [] }),
    ).toThrow(/version 2/);
  });

  it("round-trips template export wrapper", () => {
    const layout = buildDataScreenLayoutFromTemplate("blank");
    const exported = exportDataScreenTemplate(layout, "演示大屏");
    expect(exported.templateVersion).toBe(1);
    expect(exported.kind).toBe("viz-layout");
    const imported = parseImportedDataScreenLayout(exported);
    expect(imported.canvas).toEqual(layout.canvas);
    expect(imported.styleConfig?.surfaceKind).toBe("data-screen");
  });

  it("export normalizes chart dataSourceId to demo ref", () => {
    const layout = buildDataScreenLayoutFromTemplate("command-center");
    const chart = layout.widgets.find((w) => w.type === "chart");
    if (!chart || chart.type !== "chart" || !chart.chartConfig) {
      throw new Error("expected chart widget in command-center template");
    }
    chart.chartConfig = {
      ...chart.chartConfig,
      mode: "sql",
      sql: "SELECT 1",
      dataSourceId: "550e8400-e29b-41d4-a716-446655440000",
    };
    const exported = exportDataScreenTemplate(layout, "演示");
    const exportedChart = exported.layout.widgets.find((w) => w.type === "chart");
    expect(exportedChart?.chartConfig?.dataSourceId).toBe("__demo:sample_db__");
  });

  it("strips legacy grid fields from v2 widgets on import", () => {
    const imported = parseImportedDataScreenLayout({
      version: 2,
      canvas: { width: 1920, height: 1080 },
      widgets: [
        {
          id: "w1",
          type: "text",
          title: "标题",
          order: 0,
          x: 100,
          y: 80,
          width: 400,
          height: 64,
          colSpan: 12,
          rowSpan: 2,
          gridX: 0,
          gridY: 0,
          textConfig: { content: "hello", variant: "plain" },
        },
      ],
      globalFilters: [],
      styleConfig: { colorScheme: "dark" },
    });
    const widget = imported.widgets[0] as Record<string, unknown>;
    expect(widget.colSpan).toBeUndefined();
    expect(widget.rowSpan).toBeUndefined();
    expect(widget.gridX).toBeUndefined();
    expect(widget.gridY).toBeUndefined();
    expect(widget.x).toBe(100);
  });
});
