import { describe, expect, it } from "vitest";
import { crosstabSectionToTable } from "./components/ReportCrosstabResultTable";

describe("crosstabSectionToTable", () => {
  it("builds table columns and rows from matrix", () => {
    const table = crosstabSectionToTable({
      colLabels: ["1月", "2月"],
      rowLabels: ["华东", "华北"],
      matrix: [
        [10, 20],
        [5, 0],
      ],
    });
    expect(table.columns).toEqual(["", "1月", "2月"]);
    expect(table.rows).toEqual([
      ["华东", 10, 20],
      ["华北", 5, 0],
    ]);
  });
});
