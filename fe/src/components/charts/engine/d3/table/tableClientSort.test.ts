import { describe, expect, it } from "vitest";
import { compareCellValues, sortTableRows, toggleTableSort } from "./tableClientSort";

describe("tableClientSort", () => {
  it("sorts numeric columns ascending and descending", () => {
    const rows = [[10], [2], [30]];
    const asc = sortTableRows(rows, ["v"], { field: "v", direction: "asc" });
    expect(asc.map((r) => r[0])).toEqual([2, 10, 30]);
    const desc = sortTableRows(rows, ["v"], { field: "v", direction: "desc" });
    expect(desc.map((r) => r[0])).toEqual([30, 10, 2]);
  });

  it("toggles sort asc → desc → off", () => {
    expect(toggleTableSort(null, "region")).toEqual({ field: "region", direction: "asc" });
    expect(toggleTableSort({ field: "region", direction: "asc" }, "region")).toEqual({
      field: "region",
      direction: "desc",
    });
    expect(toggleTableSort({ field: "region", direction: "desc" }, "region")).toBeNull();
  });

  it("compareCellValues uses locale numeric order for text", () => {
    expect(compareCellValues("b", "a")).toBeGreaterThan(0);
    expect(compareCellValues("2", "10")).toBeLessThan(0);
  });
});
