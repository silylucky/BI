import { describe, expect, it } from "vitest";
import { resolveDevChartType } from "./devChartTypeAlias";

describe("resolveDevChartType", () => {
  it("maps column alias to bar", () => {
    expect(resolveDevChartType("column")).toBe("bar");
  });

  it("passes through catalog types", () => {
    expect(resolveDevChartType("map-3d")).toBe("map-3d");
  });

  it("returns null for empty input", () => {
    expect(resolveDevChartType(null)).toBeNull();
    expect(resolveDevChartType("")).toBeNull();
  });
});
