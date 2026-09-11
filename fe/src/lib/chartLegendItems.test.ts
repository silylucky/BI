import { describe, expect, it } from "vitest";
import { resolveChartLegendItems } from "./chartLegendItems";

describe("resolveChartLegendItems", () => {
  it("extracts funnel stage names", () => {
    const items = resolveChartLegendItems(
      {
        series: [
          {
            type: "funnel",
            data: [
              { name: "访问", value: 100 },
              { name: "注册", value: 60 },
            ],
          },
        ],
      },
      ["#111", "#222"],
    );
    expect(items).toEqual([
      { name: "访问", color: "#111" },
      { name: "注册", color: "#222" },
    ]);
  });

  it("extracts multi-series bar names", () => {
    const items = resolveChartLegendItems(
      {
        series: [
          { type: "bar", name: "销售额", data: [1] },
          { type: "bar", name: "利润", data: [2] },
        ],
      },
      ["#aaa"],
    );
    expect(items.map((item) => item.name)).toEqual(["销售额", "利润"]);
  });
});
