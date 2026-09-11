import { describe, expect, it } from "vitest";
import { blendGeoCapColor } from "@/components/charts/engine/three/buildGeoExtrudeMesh";

describe("blendGeoCapColor", () => {
  it("mixes terrain gray with data tint for visible caps", () => {
    const blended = blendGeoCapColor(0x0284c7, 0.5);
    expect(blended.getHex()).toBeGreaterThan(0x200000);
  });
});
