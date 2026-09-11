import { describe, expect, it } from "vitest";
import {
  GEO3D_FEATURE_DEGRADE_THRESHOLD,
  resolveGeo3dQuality,
} from "@/components/charts/engine/three/geo3dQuality";

describe("resolveGeo3dQuality", () => {
  it("returns high at national depth with enough pixels", () => {
    expect(
      resolveGeo3dQuality({
        drillDepth: 0,
        featureCount: 34,
        shortSide: 400,
      }),
    ).toBe("high");
  });

  it("returns medium at city depth", () => {
    expect(
      resolveGeo3dQuality({
        drillDepth: 1,
        featureCount: 21,
        shortSide: 800,
      }),
    ).toBe("medium");
  });

  it("returns low at district depth", () => {
    expect(
      resolveGeo3dQuality({
        drillDepth: 2,
        featureCount: 11,
        shortSide: 800,
      }),
    ).toBe("low");
  });

  it("returns low when feature count exceeds threshold", () => {
    expect(
      resolveGeo3dQuality({
        drillDepth: 0,
        featureCount: GEO3D_FEATURE_DEGRADE_THRESHOLD + 1,
        shortSide: 800,
      }),
    ).toBe("low");
  });

  it("respects forced high even at district depth", () => {
    expect(
      resolveGeo3dQuality({
        quality: "high",
        drillDepth: 2,
        featureCount: 10,
        shortSide: 400,
      }),
    ).toBe("high");
  });

  it("returns low when short side is below three minimum", () => {
    expect(
      resolveGeo3dQuality({
        drillDepth: 0,
        featureCount: 34,
        shortSide: 399,
      }),
    ).toBe("low");
  });

  it("thumbnail tier allows 3D on card-sized short side", () => {
    expect(
      resolveGeo3dQuality({
        drillDepth: 0,
        featureCount: 10,
        shortSide: 180,
        renderTier: "thumbnail",
      }),
    ).toBe("medium");
  });

  it("keeps 3D for list thumbnails so cards match the real screen", () => {
    expect(
      resolveGeo3dQuality({
        drillDepth: 0,
        featureCount: 10,
        shortSide: 800,
      }),
    ).toBe("high");
  });

  it("respects forced low at national depth", () => {
    expect(
      resolveGeo3dQuality({
        quality: "low",
        drillDepth: 0,
        featureCount: 10,
        shortSide: 800,
      }),
    ).toBe("low");
  });
});
