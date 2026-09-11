import { describe, expect, it } from "vitest";
import { analyzeGeoMapMatch, type GeoMapMatchStats } from "@/components/charts/engine/geo/geoMapChart";
import { buildAreaMappingLookup } from "@/lib/chartGeoAreaMapping";

/** 与 D3GeoMapView overlayHint 逻辑一致 */
function resolveGeoMatchWarning(stats: GeoMapMatchStats | null): string | null {
  if (!stats || stats.total === 0 || stats.matched >= stats.total) return null;
  return `有 ${stats.total - stats.matched} 条无法匹配地图区域`;
}

describe("geoMap areaMapping match warning", () => {
  const rows = [
    ["EAST_01", 100],
    ["广东省", 80],
  ];
  const columns = ["province", "value"];

  it("shows warning when business codes are unmatched without mapping", () => {
    const stats = analyzeGeoMapMatch(rows, columns, "province");
    expect(stats.matched).toBe(1);
    expect(resolveGeoMatchWarning(stats)).toBe("有 1 条无法匹配地图区域");
  });

  it("clears warning when areaMapping resolves all rows", () => {
    const lookup = buildAreaMappingLookup([{ id: "1", from: "EAST_01", to: "江苏省" }]);
    const stats = analyzeGeoMapMatch(rows, columns, "province", undefined, 0, lookup);
    expect(stats.matched).toBe(2);
    expect(resolveGeoMatchWarning(stats)).toBeNull();
  });
});
