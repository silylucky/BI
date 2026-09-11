import { describe, expect, it } from "vitest";
import {
  resolveTerrainPackKey,
  shouldLoadProvinceTerrainPack,
} from "@/components/charts/engine/three/geo/chinaTerrainLoader";

describe("shouldLoadProvinceTerrainPack", () => {
  it("is false at national level", () => {
    expect(shouldLoadProvinceTerrainPack("vs-regions", 0)).toBe(false);
    expect(shouldLoadProvinceTerrainPack("vs-geo-330000", 0)).toBe(false);
  });

  it("is true when drilled into a province with assets", () => {
    expect(shouldLoadProvinceTerrainPack("vs-geo-330000", 1)).toBe(true);
    expect(resolveTerrainPackKey("vs-geo-330000", 1).level).toBe("province");
  });

  it("is true for city map ids under a province", () => {
    expect(shouldLoadProvinceTerrainPack("vs-geo-330100", 2)).toBe(true);
  });
});
