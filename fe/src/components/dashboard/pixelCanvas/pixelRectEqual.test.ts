import { describe, expect, it } from "vitest";
import { pixelRectsNearlyEqual } from "./pixelRectEqual";

describe("pixelRectsNearlyEqual", () => {
  it("treats sub-pixel viewport drift as equal", () => {
    const a = { x: 0, y: 12.1, width: 710.2, height: 698.4 };
    const b = { x: 0, y: 12.3, width: 710.4, height: 698.6 };
    expect(pixelRectsNearlyEqual(a, b)).toBe(true);
  });

  it("detects meaningful viewport changes", () => {
    const a = { x: 0, y: 0, width: 700, height: 600 };
    const b = { x: 40, y: 0, width: 700, height: 600 };
    expect(pixelRectsNearlyEqual(a, b)).toBe(false);
  });
});
