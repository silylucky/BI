import { describe, expect, it } from "vitest";
import {
  buildAreaMappingImportRows,
  countImportableUnmatchedValues,
  listUnmatchedGeoRegionValues,
} from "./geoAreaMappingFromData";

describe("listUnmatchedGeoRegionValues", () => {
  const columns = ["province", "value"];
  const rows = [
    ["江苏省", 1],
    ["EAST_01", 2],
    ["EAST_01", 3],
    ["浙江省", 4],
  ];

  it("returns unique unmatched raw values", () => {
    expect(listUnmatchedGeoRegionValues(rows, columns, "province")).toEqual(["EAST_01"]);
  });

  it("respects areaMapping lookup", () => {
    const lookup = new Map([["EAST_01", "江苏省"]]);
    expect(listUnmatchedGeoRegionValues(rows, columns, "province", lookup)).toEqual([]);
  });
});

describe("buildAreaMappingImportRows", () => {
  it("appends rows for new unmatched values only", () => {
    const existing = [{ id: "a", from: "OLD", to: "北京市" }];
    const next = buildAreaMappingImportRows(existing, ["EAST_01", "OLD"], () => "new-id");
    expect(next).toHaveLength(2);
    expect(next[0]).toEqual(existing[0]);
    expect(next[1]).toMatchObject({ id: "new-id", from: "EAST_01", to: "" });
  });
});

describe("countImportableUnmatchedValues", () => {
  it("skips values already present in mapping table", () => {
    const columns = ["province", "value"];
    const rows = [["EAST_01", 1], ["WEST_02", 2]];
    const existing = [{ id: "a", from: "EAST_01", to: "" }];
    expect(countImportableUnmatchedValues(rows, columns, "province", existing)).toBe(1);
  });
});
