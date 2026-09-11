import { describe, expect, it } from "vitest";
import {
  applyConditionalRulesToEchartsOption,
  applyConditionalRulesToG2PlotOptions,
  applyMarkLinesToEchartsOption,
  patchChartDeFeatures,
} from "./chartDeFeatures";
import type { ChartViewConfig } from "./chartViewConfig";

const baseCfg: ChartViewConfig = {
  chartType: "bar",
  dataSourceId: "ds",
  mode: "sql",
  sql: "select 1",
  dimensions: [{ field: "d" }],
  metrics: [{ field: "m" }],
};

describe("chartDeFeatures", () => {
  it("patches mark lines into nativeBody.deFeatures", () => {
    const next = patchChartDeFeatures(baseCfg, {
      markLines: [
        { id: "l1", enabled: true, axis: "y", value: 100, color: "#f00" },
      ],
    });
    const lines = (next.nativeBody?.deFeatures as { markLines?: unknown[] })?.markLines;
    expect(lines).toHaveLength(1);
  });

  it("applyMarkLinesToEchartsOption adds markLine to first series", () => {
    const option = {
      series: [{ type: "bar", data: [1, 2, 3] }],
    };
    const next = applyMarkLinesToEchartsOption(option, [
      { id: "l1", enabled: true, axis: "y", value: 50, name: "目标" },
    ]);
    const series = next.series as { markLine?: { data: unknown[] } }[];
    expect(series[0]?.markLine?.data).toHaveLength(1);
  });

  it("applyConditionalRulesToEchartsOption colors matching bars", () => {
    const option = {
      series: [{ type: "bar", data: [10, 30, 5] }],
    };
    const next = applyConditionalRulesToEchartsOption(option, [
      { id: "r1", enabled: true, operator: "gte", value: 20, color: "#12b76a" },
    ]);
    const data = (next.series as { data: { itemStyle?: { color?: string } }[] }[])[0].data;
    expect(data[1]?.itemStyle?.color).toBe("#12b76a");
    expect(data[0]?.itemStyle?.color).toBeUndefined();
  });

  it("applyConditionalRulesToG2PlotOptions sets columnStyle for Column", () => {
    const options = applyConditionalRulesToG2PlotOptions(
      { data: [{ x: "a", y: 30 }], xField: "x", yField: "y" },
      "Column",
      [{ id: "r1", enabled: true, operator: "gte", value: 20, color: "#12b76a" }],
    );
    expect(typeof options.columnStyle).toBe("function");
    const styled = (options.columnStyle as (d: Record<string, unknown>) => { fill?: string })({
      y: 30,
    });
    expect(styled.fill).toBe("#12b76a");
  });
});
