import { describe, expect, it } from "vitest";
import { buildStyleContext } from "@/components/charts/engine/buildStyleContext";
import type { ChartViewConfig } from "@/lib/chartViewConfig";

const baseConfig: ChartViewConfig = {
  chartType: "table-info",
  mode: "sql",
  dataSourceId: "",
  dimensions: [],
  metrics: [],
};

describe("buildStyleContext tableColorStyle", () => {
  it("forwards dashboard tableColorStyle into chart style context", () => {
    const ctx = buildStyleContext({
      config: baseConfig,
      scheme: "light",
      chartColors: ["#111111"],
      dashboardDefaults: {
        tableColorStyle: { headerBg: "#eef2ff", borderColor: "#86cbec" },
      },
    });
    expect(ctx.tableColorStyle).toEqual({
      headerBg: "#eef2ff",
      borderColor: "#86cbec",
    });
  });
});
