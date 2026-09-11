import { describe, expect, it } from "vitest";
import { compareGeo3dStyleUpdate } from "./geo3dStylePatch";

describe("compareGeo3dStyleUpdate", () => {
  it("returns noop when style unchanged", () => {
    const style = { stylePreset: "tech" as const, platformEffects: true };
    expect(compareGeo3dStyleUpdate(style, {}, style, {})).toBe("noop");
  });

  it("returns patched for visual-only opacity change", () => {
    const prev = { stylePreset: "satellite" as const, shellOpacity: 1 };
    const next = { stylePreset: "satellite" as const, shellOpacity: 0.5 };
    expect(compareGeo3dStyleUpdate(prev, {}, next, {})).toBe("patched");
  });

  it("returns layer-rebuilt when cloud density changes", () => {
    const prev = { stylePreset: "tech" as const, sceneCloudDensity: 0.4 };
    const next = { stylePreset: "tech" as const, sceneCloudDensity: 0.9 };
    expect(compareGeo3dStyleUpdate(prev, {}, next, {})).toBe("layer-rebuilt");
  });

  it("returns full-rebuild when extrude intensity changes", () => {
    const prev = { stylePreset: "tech" as const, extrudeIntensity: 0.5 };
    const next = { stylePreset: "tech" as const, extrudeIntensity: 0.9 };
    expect(compareGeo3dStyleUpdate(prev, {}, next, {})).toBe("full-rebuild");
  });
});
