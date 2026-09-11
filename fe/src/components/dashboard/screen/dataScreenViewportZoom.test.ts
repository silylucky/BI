import { describe, expect, it } from "vitest";
import {
  clampDataScreenUserZoom,
  formatDataScreenZoomPercent,
  stepDataScreenUserZoom,
} from "./dataScreenViewportZoom";

describe("dataScreenViewportZoom", () => {
  it("clamps zoom into supported range", () => {
    expect(clampDataScreenUserZoom(0.1)).toBe(0.25);
    expect(clampDataScreenUserZoom(3)).toBe(2);
  });

  it("formats zoom percent label", () => {
    expect(formatDataScreenZoomPercent(0.6)).toBe("60%");
  });

  it("steps zoom in button increments", () => {
    expect(stepDataScreenUserZoom(1, 1)).toBe(1.1);
    expect(stepDataScreenUserZoom(0.25, -1)).toBe(0.25);
  });
});
