import { describe, expect, it } from "vitest";
import "@/components/charts/engine/plugins/index";
import {
  getEngineIdForChartType,
  isCanvasChartType,
  isS2TableChartType,
  listRegisteredCanvasChartTypes,
} from "@/components/charts/engine/registry";
import { getChartPlugin, listChartPluginTypes } from "@/components/charts/engine/plugins/registry";

describe("chart engine registry", () => {
  it("registers builtin plugins", () => {
    expect(listChartPluginTypes().length).toBeGreaterThanOrEqual(40);
  });

  it("maps canvas chart types to antv", () => {
    for (const chartType of ["line", "bar", "pie", "map", "chart-mix", "table-info"]) {
      expect(getEngineIdForChartType(chartType)).toBe("antv");
      expect(isCanvasChartType(chartType)).toBe(true);
    }
  });

  it("maps legacy table to react engine and kpi to antv canvas", () => {
    expect(getEngineIdForChartType("table")).toBe("table");
    expect(getEngineIdForChartType("kpi")).toBe("antv");
    expect(isCanvasChartType("table")).toBe(false);
    expect(isCanvasChartType("kpi")).toBe(true);
    expect(getChartPlugin("kpi")?.library).toBe("d3");
  });

  it("routes d3 table types through antv canvas host", () => {
    expect(isS2TableChartType("table-info")).toBe(true);
    expect(getChartPlugin("table-info")?.library).toBe("d3");
  });

  it("routes line chart through d3 renderer", () => {
    expect(getChartPlugin("line")?.library).toBe("d3");
  });

  it("lists registered canvas types from plugins", () => {
    const canvasTypes = listRegisteredCanvasChartTypes();
    expect(canvasTypes).toContain("bar-stack");
    expect(canvasTypes).toContain("t-heatmap");
    expect(canvasTypes).toContain("kpi");
    expect(canvasTypes).toContain("table-info");
  });
});
