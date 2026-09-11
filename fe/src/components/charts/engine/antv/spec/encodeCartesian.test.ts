import { describe, expect, it } from "vitest";
import { encodeCartesianRows } from "@/components/charts/engine/antv/spec/encodeCartesian";
import type { RenderSpec } from "@/components/charts/engine/types";

const COLUMNS = ["region_name", "sale_date", "amount"];
const ROWS: unknown[][] = [
  ["华东", "2025-01-05", 100],
  ["华北", "2025-01-05", 200],
  ["华东", "2025-02-15", 150],
  ["华北", "2025-02-15", 180],
];

function lineSpec(dimensions: RenderSpec["encoding"]["dimensions"], metrics: RenderSpec["encoding"]["metrics"]): RenderSpec {
  return {
    chartType: "line",
    styleVariant: "default",
    encoding: { dimensions, metrics },
  };
}

describe("encodeCartesianRows", () => {
  it("splits series by subcategory dimension like DataEase xAxisExt", () => {
    const enc = encodeCartesianRows(
      lineSpec(
        [{ field: "region_name" }, { field: "sale_date" }],
        [{ field: "amount" }],
      ),
      ROWS,
      COLUMNS,
      "line",
    );

    expect(enc.seriesField).toBe("__series__");
    expect([...new Set(enc.data.map((d) => d.__series__))].sort()).toEqual([
      "2025-01-05",
      "2025-02-15",
    ]);
    expect([...new Set(enc.data.map((d) => d.__category__))].sort()).toEqual(["华东", "华北"]);
  });

  it("uses single series when subcategory is absent", () => {
    const enc = encodeCartesianRows(
      lineSpec([{ field: "sale_date" }], [{ field: "amount" }]),
      ROWS,
      COLUMNS,
      "line",
    );

    expect(enc.seriesField).toBeUndefined();
    expect(enc.data).toHaveLength(2);
    expect(enc.data.map((d) => d.__category__)).toEqual(["2025-01-05", "2025-02-15"]);
  });

  it("composites multiple xAxis fields into category keys (MULTI_DIM)", () => {
    const enc = encodeCartesianRows(
      {
        chartType: "line",
        styleVariant: "default",
        encoding: {
          dimensions: [{ field: "region_name" }, { field: "sale_date" }],
          metrics: [{ field: "amount" }],
          axes: {
            xAxis: [{ field: "region_name" }, { field: "sale_date" }],
          },
        },
      },
      ROWS,
      COLUMNS,
      "line",
    );

    expect(enc.seriesField).toBeUndefined();
    expect(enc.data.map((d) => d.__category__)).toEqual([
      "华东\u00012025-01-05",
      "华北\u00012025-01-05",
      "华东\u00012025-02-15",
      "华北\u00012025-02-15",
    ]);
  });
});
