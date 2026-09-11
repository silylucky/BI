import { describe, expect, it } from "vitest";
import * as d3 from "d3";
import { groupSeries, resolveSeriesKeys, seriesDataKey } from "./series";

describe("series keys", () => {
  it("maps empty series name to value column", () => {
    expect(seriesDataKey("")).toBe("value");
    expect(resolveSeriesKeys([""])).toEqual(["value"]);
  });

  it("groupSeries without seriesField uses value key", () => {
    const groups = groupSeries(
      [
        { __category__: "2025-01-01", __value__: 100 },
        { __category__: "2025-01-02", __value__: 200 },
      ],
      undefined,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]?.name).toBe("value");
    expect(resolveSeriesKeys(groups.map((g) => g.name))).toEqual(["value"]);
  });

  it("stack max uses same keys as wide rows", () => {
    const groups = groupSeries([{ __category__: "A", __value__: 9459 }], undefined);
    const keys = resolveSeriesKeys(groups.map((g) => g.name));
    const row: Record<string, number> = { value: 9459 };
    const maxVal = keys.reduce((sum, k) => sum + Number(row[seriesDataKey(k)] ?? row[k] ?? 0), 0);
    expect(maxVal).toBe(9459);
  });
});

describe("area-stack y domain", () => {
  it("does not collapse to zero for single-series stack", () => {
    const keys = resolveSeriesKeys(["value"]);
    const wideRows = [{ __category__: "2025-02-15", value: 9459 }];
    const maxVal =
      d3.max(wideRows, (row) => keys.reduce((sum, k) => sum + Number(row[k as keyof typeof row] ?? 0), 0)) ?? 0;
    expect(maxVal).toBe(9459);
  });
});
