import { describe, expect, it } from "vitest";
import {
  computePresentationTransform,
  resolveDataScreenEditViewportOffsets,
  resolveDataScreenViewportOffsets,
} from "./presentationScale";

describe("presentationScale", () => {
  it("fit scales uniformly to fit container", () => {
    const t = computePresentationTransform(1280, 720, 1920, 1080, "fit");
    expect(t.scaleX).toBeCloseTo(1280 / 1920, 5);
    expect(t.scaleY).toBe(t.scaleX);
    expect(t.scaleX).toBeGreaterThan(0);
    expect(t.scaleX).toBeLessThanOrEqual(1);
  });

  it("fill uses independent axis scales", () => {
    const t = computePresentationTransform(800, 600, 1920, 1080, "fill");
    expect(t.scaleX).toBeCloseTo(800 / 1920, 5);
    expect(t.scaleY).toBeCloseTo(600 / 1080, 5);
  });

  it("none keeps design size", () => {
    const t = computePresentationTransform(800, 600, 1920, 1080, "none");
    expect(t.scaleX).toBe(1);
    expect(t.scaleY).toBe(1);
  });

  it("fitWidth scales by container width", () => {
    const t = computePresentationTransform(1000, 600, 1920, 1080, "fitWidth");
    expect(t.scaleX).toBeCloseTo(1000 / 1920, 5);
    expect(t.scaleY).toBe(t.scaleX);
  });

  it("fitWidth offset pins width and centers short canvas vertically", () => {
    const base = computePresentationTransform(1000, 800, 1920, 540, "fitWidth");
    const scale = base.scaleX;
    const offsets = resolveDataScreenViewportOffsets(
      "fitWidth",
      1000,
      800,
      base,
      1920 * scale,
      540 * scale,
    );
    expect(offsets.offsetX).toBe(0);
    expect(offsets.offsetY).toBeGreaterThan(0);
  });

  it("fitHeight offset pins height and centers narrow canvas horizontally", () => {
    const base = computePresentationTransform(1000, 800, 1280, 1080, "fitHeight");
    const scale = base.scaleX;
    const offsets = resolveDataScreenViewportOffsets(
      "fitHeight",
      1000,
      800,
      base,
      1280 * scale,
      1080 * scale,
    );
    expect(offsets.offsetY).toBe(0);
    expect(offsets.offsetX).toBeGreaterThan(0);
  });

  it("edit viewport offsets pin canvas to top-left", () => {
    expect(resolveDataScreenEditViewportOffsets()).toEqual({ offsetX: 0, offsetY: 0 });
  });
});
