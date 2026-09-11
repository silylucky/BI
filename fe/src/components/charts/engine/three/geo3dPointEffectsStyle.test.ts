import { describe, expect, it } from "vitest";
import {
  buildPointEffectsContentSig,
  resolveGeo3dPointEffects,
  resolvePointEffectsStyle,
} from "@/components/charts/engine/three/geo3dPointEffectsStyle";

describe("geo3dPointEffectsStyle", () => {
  it("tech preset enables point effects by default", () => {
    expect(resolveGeo3dPointEffects({ stylePreset: "tech" })).toBe(true);
    expect(resolveGeo3dPointEffects({ stylePreset: "satellite" })).toBe(true);
  });

  it("respects per-layer toggles", () => {
    const resolved = resolvePointEffectsStyle(
      { stylePreset: "tech", heatBlob: false, pointPillar: true, floatingLabels: false },
      "tech",
      true,
      true,
    );
    expect(resolved.layers.heatBlob).toBe(false);
    expect(resolved.layers.pointPillar).toBe(true);
    expect(resolved.layers.floatingLabels).toBe(false);
  });

  it("builds stable content signature", () => {
    const sig = buildPointEffectsContentSig({ stylePreset: "tech", pointPillarRingSpeed: 2 }, true);
    expect(sig).toContain("2");
  });

  it("tech preset uses warm pillar colors", () => {
    const resolved = resolvePointEffectsStyle({ stylePreset: "tech" }, "tech", true, true);
    expect(resolved.pointPillarColorTop).toBe("#fbdf88");
    expect(resolved.pointPillarColorBottom).toBe("#ea580c");
    expect(resolved.pointPillarBaseRingScale).toBe(0.6);
  });

  it("classic preset enables point effects by default", () => {
    expect(resolveGeo3dPointEffects({ stylePreset: "classic" })).toBe(true);
    expect(resolveGeo3dPointEffects({ stylePreset: "glass" })).toBe(true);
  });

  it("applies custom floating label colors", () => {
    const resolved = resolvePointEffectsStyle(
      {
        stylePreset: "tech",
        floatingLabelTextColor: "#112233",
        floatingLabelBgColor: "#445566",
        floatingLabelBorderColor: "#778899",
      },
      "tech",
      true,
      true,
    );
    expect(resolved.floatingLabelTextColor).toBe("#112233");
    expect(resolved.floatingLabelBgColor).toBe("#445566");
    expect(resolved.floatingLabelBorderColor).toBe("#778899");
  });
});
