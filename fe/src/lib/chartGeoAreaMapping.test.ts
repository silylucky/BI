import { describe, expect, it } from "vitest";
import {
  applyAreaMapping,
  buildAreaMappingLookup,
  countEffectiveAreaMappings,
  normalizeAreaMappingEntries,
} from "./chartGeoAreaMapping";

describe("chartGeoAreaMapping", () => {
  it("buildAreaMappingLookup trims keys and later from wins", () => {
    const lookup = buildAreaMappingLookup([
      { id: "1", from: " EAST_01 ", to: "江苏省" },
      { id: "2", from: "EAST_01", to: "浙江省" },
    ]);
    expect(lookup.get("EAST_01")).toBe("浙江省");
  });

  it("filters empty from/to rows", () => {
    expect(
      normalizeAreaMappingEntries([
        { id: "1", from: "  ", to: "江苏省" },
        { id: "2", from: "GD", to: "" },
        { id: "3", from: "BJ", to: "北京市" },
      ]),
    ).toEqual([{ id: "3", from: "BJ", to: "北京市" }]);
  });

  it("countEffectiveAreaMappings ignores blanks", () => {
    expect(
      countEffectiveAreaMappings([
        { id: "1", from: "A", to: "北京市" },
        { id: "2", from: "", to: "上海市" },
      ]),
    ).toBe(1);
  });

  it("applyAreaMapping returns original when no hit", () => {
    const lookup = buildAreaMappingLookup([{ id: "1", from: "X", to: "江苏省" }]);
    expect(applyAreaMapping("UNKNOWN", lookup)).toBe("UNKNOWN");
    expect(applyAreaMapping(42, lookup)).toBe(42);
    expect(applyAreaMapping("X", lookup)).toBe("江苏省");
  });
});
