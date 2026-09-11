import { describe, expect, it } from "vitest";
import {
  buildCartesianCategorySeries,
  compositeCategoryKey,
  formatCompositeCategoryDisplay,
  inferEffectiveCategoryLevels,
  resolveCartesianAxisFields,
  sortCompositeCategoryKeys,
} from "./buildDatasetEncoding";
import type { RenderSpec } from "./types";

describe("buildCartesianCategorySeries multi category", () => {
  const COLUMNS = ["region", "month", "amount"];
  const ROWS: unknown[][] = [
    ["华东", "2025-01", 100],
    ["华东", "2025-02", 150],
    ["华北", "2025-01", 200],
    ["华北", "2025-02", 180],
  ];

  it("composites multiple xAxis fields into category keys", () => {
    const spec: Pick<RenderSpec, "encoding" | "styleVariant"> = {
      styleVariant: "default",
      encoding: {
        dimensions: [{ field: "region" }, { field: "month" }],
        metrics: [{ field: "amount" }],
        axes: {
          xAxis: [{ field: "region" }, { field: "month" }],
        },
      },
    };

    const { categoryFields } = resolveCartesianAxisFields(spec.encoding);
    expect(categoryFields).toEqual(["region", "month"]);

    const key = compositeCategoryKey(ROWS[0]!, COLUMNS, categoryFields);
    expect(key).toBe("华东\u00012025-01");

    const built = buildCartesianCategorySeries(spec, ROWS, COLUMNS, "line");
    expect(built.xData).toHaveLength(4);
    expect(built.series).toHaveLength(1);
    expect(built.series[0]?.data).toHaveLength(4);
  });

  it("splits series by xAxisExt subcategory when axes are configured", () => {
    const spec: Pick<RenderSpec, "encoding" | "styleVariant"> = {
      styleVariant: "default",
      encoding: {
        dimensions: [{ field: "region" }, { field: "month" }],
        metrics: [{ field: "amount" }],
        axes: {
          xAxis: [{ field: "region" }],
          xAxisExt: [{ field: "month" }],
        },
      },
    };

    const built = buildCartesianCategorySeries(spec, ROWS, COLUMNS, "line");
    expect(built.xData.sort()).toEqual(["华东", "华北"]);
    expect(built.series.map((s) => s.name).sort()).toEqual(["2025-01", "2025-02"]);
  });

  it("formatCompositeCategoryDisplay joins internal keys for axis/tooltip", () => {
    const key = compositeCategoryKey(ROWS[0]!, COLUMNS, ["region", "month"]);
    expect(formatCompositeCategoryDisplay(key)).toBe("华东 / 2025-01");
  });

  it("inferEffectiveCategoryLevels ignores trailing empty dimensions", () => {
    const key = `华东${"\u0001"}${"\u0001"}null`;
    expect(inferEffectiveCategoryLevels([key, "华北"])).toBe(1);
  });

  it("sortCompositeCategoryKeys orders by dimension hierarchy", () => {
    const SEP = "\u0001";
    const keys = [
      `2025-07-08${SEP}江苏省${SEP}机械键盘${SEP}外设配件`,
      `2025-05-22${SEP}甘肃省${SEP}无线鼠标${SEP}外设配件`,
      `2025-05-22${SEP}甘肃省${SEP}机械键盘${SEP}显示设备`,
      `2025-07-08${SEP}甘肃省${SEP}无线鼠标${SEP}外设配件`,
    ];
    const sorted = sortCompositeCategoryKeys(keys);
    expect(sorted[0]?.startsWith("2025-05-22")).toBe(true);
    expect(sorted.every((k) => k.startsWith("2025-05-22") || k.startsWith("2025-07-08"))).toBe(true);
    const may22 = sorted.filter((k) => k.startsWith("2025-05-22"));
    expect(may22.every((k) => k.includes("甘肃省"))).toBe(true);
  });
});
