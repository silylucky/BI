import { describe, expect, it } from "vitest";
import {
  buildCanvasRulerTicks,
  resolveCanvasRulerScrollOffset,
  resolveRulerStepDensity,
} from "./canvasRulerUtils";

describe("canvasRulerUtils", () => {
  it("uses denser steps when zoomed in", () => {
    expect(resolveRulerStepDensity(1)).toEqual({
      microStep: 5,
      minorStep: 10,
      labelStep: 50,
    });
    expect(resolveRulerStepDensity(0.2).labelStep).toBeGreaterThanOrEqual(100);
  });

  it("builds micro/minor/major ticks with scroll offset", () => {
    const ticks = buildCanvasRulerTicks(1920, 0.5, 25, 800);
    expect(ticks.some((tick) => tick.kind === "major" && tick.value === 100)).toBe(true);
    expect(ticks.some((tick) => tick.kind === "micro")).toBe(true);
    expect(ticks.find((tick) => tick.value === 100)?.positionPx).toBe(25);
  });

  it("suppresses overlapping labels on dense horizontal rulers", () => {
    const ticks = buildCanvasRulerTicks(1920, 1, 0, 400);
    const labels = ticks.filter((tick) => tick.showLabel);
    for (let i = 1; i < labels.length; i += 1) {
      expect(labels[i]!.positionPx - labels[i - 1]!.positionPx).toBeGreaterThanOrEqual(40);
    }
  });

  it("aligns design zero with letterboxed canvas origin", () => {
    const scale = 0.5;
    const contentOffsetY = 40;
    const scrollOffset = resolveCanvasRulerScrollOffset(0, contentOffsetY);
    const ticks = buildCanvasRulerTicks(1080, scale, scrollOffset, 600);
    expect(ticks.find((tick) => tick.value === 0)?.positionPx).toBe(40);
    expect(ticks.find((tick) => tick.value === 200)?.positionPx).toBe(140);
  });

  it("tracks view pan in ruler scroll offset", () => {
    const scrollOffset = resolveCanvasRulerScrollOffset(30, 40);
    expect(scrollOffset).toBe(-70);
    const ticks = buildCanvasRulerTicks(1080, 1, scrollOffset, 400);
    expect(ticks.find((tick) => tick.value === 0)?.positionPx).toBe(70);
  });
});
