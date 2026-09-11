import { describe, expect, it } from "vitest";
import {
  lookupAnchorName,
  resolveRowRegionAnchorLngLat,
  resetNationalRegionAnchorMapForTests,
} from "@/components/charts/engine/geo/geoHeatRegionAnchors";

describe("geoHeatRegionAnchors", () => {
  it("resolves province and city names from anchor map", () => {
    resetNationalRegionAnchorMapForTests();
    const anchors = new Map<string, [number, number]>([
      ["四川省", [104.06, 30.67]],
      ["成都市", [104.06, 30.65]],
    ]);
    expect(resolveRowRegionAnchorLngLat("province", "四川省", anchors)).toEqual([
      104.06, 30.67,
    ]);
    expect(resolveRowRegionAnchorLngLat("city", "成都市", anchors)).toEqual([
      104.06, 30.65,
    ]);
    expect(resolveRowRegionAnchorLngLat("city", "成都", anchors)).toEqual([104.06, 30.65]);
  });

  it("rolls up demo region_id from district to city anchor", () => {
    const anchors = new Map<string, [number, number]>([
      ["四川省", [104.06, 30.67]],
      ["成都市", [104.06, 30.65]],
    ]);
    expect(resolveRowRegionAnchorLngLat("region_id", 911, anchors)).toEqual([
      104.06, 30.65,
    ]);
  });

  it("resolves each full name independently without cross-matching", () => {
    const anchors = new Map<string, [number, number]>([
      ["朝阳市", [120.45, 41.57]],
      ["朝阳区", [116.44, 39.92]],
    ]);
    expect(lookupAnchorName("朝阳市", anchors)).toEqual([120.45, 41.57]);
    expect(lookupAnchorName("朝阳区", anchors)).toEqual([116.44, 39.92]);
    expect(lookupAnchorName("北京市", anchors)).toBeNull();
  });
});
