import { describe, expect, it } from "vitest";
import { VCDS, motionDuration, setMotionIntensity } from "./chartVisualTokens";
import { resolveRenderMode, sampleIndices } from "./perfRouter";

describe("chartVisualTokens", () => {
  it("exposes motion durations", () => {
    expect(VCDS.motion.enter).toBe(720);
    setMotionIntensity("off");
    expect(motionDuration("enter")).toBe(0);
    setMotionIntensity("standard");
    expect(motionDuration("hover")).toBe(120);
  });
});

describe("perfRouter", () => {
  it("picks svg-full for small datasets", () => {
    expect(resolveRenderMode(100)).toBe("svg-full");
    expect(resolveRenderMode(2000)).toBe("svg-sampled");
    expect(resolveRenderMode(8000, "Scatter")).toBe("hybrid-canvas");
  });

  it("samples indices preserving last point", () => {
    const idx = sampleIndices(100, 10);
    expect(idx[0]).toBe(0);
    expect(idx[idx.length - 1]).toBe(99);
  });
});
