import { describe, expect, it } from "vitest";
import {
  estimateVisualGapPx,
  hasPositiveOuterGaps,
  measurePixelLayoutOuterGaps,
} from "./gapRuntimeProbe";

const left = { id: "a", x: 0, y: 0, width: 400, height: 200 };
const rightTouching = { id: "b", x: 400, y: 0, width: 400, height: 200 };
const rightSlack = { id: "c", x: 420, y: 0, width: 400, height: 200 };

describe("gapRuntimeProbe", () => {
  it("reports no outer gap when rects touch", () => {
    expect(measurePixelLayoutOuterGaps([left, rightTouching])).toEqual([]);
    expect(hasPositiveOuterGaps([left, rightTouching])).toBe(false);
  });

  it("reports horizontal outer slack", () => {
    const gaps = measurePixelLayoutOuterGaps([left, rightSlack]);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({
      aId: "a",
      bId: "c",
      axis: "horizontal",
      gapPx: 20,
    });
  });

  it("ignores non-adjacent vertical slack in the same column", () => {
    const top = { id: "a", x: 0, y: 0, width: 480, height: 280 };
    const middle = { id: "b", x: 0, y: 280, width: 480, height: 280 };
    const bottom = { id: "c", x: 0, y: 560, width: 480, height: 280 };
    expect(measurePixelLayoutOuterGaps([top, middle, bottom])).toEqual([]);
    expect(hasPositiveOuterGaps([top, middle, bottom])).toBe(false);
  });

  it("estimates visual gap from shell padding when outer rects touch", () => {
    expect(estimateVisualGapPx(0, 5)).toBe(10);
    expect(estimateVisualGapPx(20, 0)).toBe(20);
  });
});
