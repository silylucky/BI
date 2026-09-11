import { describe, expect, it } from "vitest";
import {
  parseCategorySeriesPayload,
  parseDateSortKey,
  pickNearestPointIndex,
  resolveEncodingIndices,
} from "./customVizDataHelpers";

describe("customVizDataHelpers", () => {
  it("resolveEncodingIndices maps bound field names to column indices", () => {
    const cols = ["sale_date", "amount", "quantity"];
    expect(
      resolveEncodingIndices(cols, {
        dimensions: ["sale_date"],
        metrics: ["quantity", "amount"],
      }),
    ).toEqual({
      dimensionIndices: [0],
      metricIndices: [2, 1],
    });
  });

  it("parseCategorySeriesPayload sorts by date dimension", () => {
    const parsed = parseCategorySeriesPayload({
      columns: ["sale_date", "amount"],
      rows: [
        ["2024-03-01", 30],
        ["2024-01-01", 10],
        ["2024-02-01", 20],
      ],
      encoding: { dimensions: ["sale_date"], metrics: ["amount"] },
    });
    expect(parsed?.categories).toEqual(["2024-01-01", "2024-02-01", "2024-03-01"]);
    expect(parsed?.series[0].values).toEqual([10, 20, 30]);
  });

  it("parseDateSortKey accepts ISO-like dates", () => {
    expect(parseDateSortKey("2024-01-15")).toBe(Date.parse("2024-01-15"));
    expect(parseDateSortKey("province")).toBeNull();
  });

  it("pickNearestPointIndex chooses closest point within radius", () => {
    expect(
      pickNearestPointIndex(
        12,
        12,
        [
          { x: 10, y: 10 },
          { x: 100, y: 100 },
        ],
        20,
      ),
    ).toBe(0);
  });
});
