import { describe, expect, it } from "vitest";
import {
  autoSuggestAreaMappingEntries,
  buildGeoAreaMappingViewRows,
  listDistinctRegionFieldValues,
  mergeAreaMappingAttribute,
  suggestDataValueForMapRegion,
} from "./geoAreaMappingTable";

describe("geoAreaMappingTable", () => {
  const columns = ["province", "value"];
  const rows = [
    ["江苏省", 1],
    ["EAST_01", 2],
    ["江苏省", 3],
  ];

  it("lists distinct region field values", () => {
    expect(listDistinctRegionFieldValues(rows, columns, "province")).toEqual([
      "江苏省",
      "EAST_01",
    ]);
  });

  it("suggests data value for map region via resolve chain", () => {
    expect(
      suggestDataValueForMapRegion("江苏省", ["EAST_01", "江苏省"], "province"),
    ).toBe("江苏省");
  });

  it("builds view rows with auto suggestion", () => {
    const view = buildGeoAreaMappingViewRows(
      ["北京市", "江苏省"],
      ["江苏省"],
      [],
      "province",
    );
    expect(view[0]).toMatchObject({ mapRegion: "北京市", dataValue: "" });
    expect(view[1]).toMatchObject({ mapRegion: "江苏省", dataValue: "江苏省" });
  });

  it("merges attribute edits into areaMapping entries", () => {
    const next = mergeAreaMappingAttribute(
      [{ id: "a", from: "OLD", to: "北京市" }],
      "江苏省",
      "EAST_01",
      () => "new-id",
    );
    expect(next).toEqual([
      { id: "a", from: "OLD", to: "北京市" },
      { id: "new-id", from: "EAST_01", to: "江苏省" },
    ]);
  });

  it("auto suggests entries when mapping empty", () => {
    const entries = autoSuggestAreaMappingEntries(
      ["北京市", "江苏省"],
      ["江苏省", "北京市"],
      "province",
      [],
      () => "id-1",
    );
    expect(entries.length).toBe(2);
    expect(entries.some((e) => e.to === "江苏省" && e.from === "江苏省")).toBe(true);
    expect(entries.some((e) => e.to === "北京市" && e.from === "北京市")).toBe(true);
  });
});
