import { describe, expect, it } from "vitest";
import {
  anyBoxesOverlap,
  bboxFromAnchor,
  boxesOverlap,
  pickCandidatesWithoutOverlap,
  pickCircularThinIndicesWithoutOverlap,
  pickThinIndicesWithoutBBoxOverlap,
} from "./labelOverlap";

describe("labelOverlap", () => {
  it("detects overlapping boxes", () => {
    const a = bboxFromAnchor(0, 0, 40, 12, "middle");
    const b = bboxFromAnchor(10, 0, 40, 12, "middle");
    expect(boxesOverlap(a, b)).toBe(true);
    expect(boxesOverlap(a, bboxFromAnchor(80, 0, 20, 12, "middle"))).toBe(false);
  });

  it("thins indices until bboxes do not overlap", () => {
    const count = 20;
    const indices = pickThinIndicesWithoutBBoxOverlap(
      count,
      (i) => `标签${i}`,
      11,
      (i) => i * 24,
      (i, text) => bboxFromAnchor(i * 24, 0, text.length * 7, 12, "middle"),
      4,
    );
    const boxes = indices.map((i) => bboxFromAnchor(i * 24, 0, `标签${i}`.length * 7, 12, "middle"));
    expect(anyBoxesOverlap(boxes)).toBe(false);
    expect(indices.length).toBeLessThan(count);
  });

  it("picks high-priority candidates first", () => {
    const visible = pickCandidatesWithoutOverlap([
      { key: "low", priority: 1, bbox: bboxFromAnchor(0, 0, 40, 12, "middle") },
      { key: "high", priority: 99, bbox: bboxFromAnchor(5, 0, 40, 12, "middle") },
      { key: "far", priority: 10, bbox: bboxFromAnchor(100, 0, 20, 12, "middle") },
    ]);
    expect(visible.has("high")).toBe(true);
    expect(visible.has("far")).toBe(true);
    expect(visible.has("low")).toBe(false);
  });

  it("pick circular simple labels", () => {
    const indices = pickCircularThinIndicesWithoutOverlap(5, (i) => `dim-${i}`, 11, 120, 6);
    expect(indices.length).toBeGreaterThan(0);
  });

  it("thins circular radar axis labels", () => {
    const count = 12;
    const texts = Array.from({ length: count }, (_, i) => `维度${i}`);
    const labelFor = (i: number) => texts[i] ?? "";
    const indices = pickCircularThinIndicesWithoutOverlap(count, labelFor, 11, 120, 6);
    expect(indices.length).toBeGreaterThan(0);
    expect(indices.length).toBeLessThanOrEqual(count);
  });

  it("thins 35 long date circular labels", () => {
    const count = 35;
    const texts = Array.from({ length: count }, (_, i) => {
      const day = String(i + 1).padStart(2, "0");
      return `2025-01-${day}`;
    });
    const labelFor = (i: number) => texts[i] ?? "";
    const indices = pickCircularThinIndicesWithoutOverlap(count, labelFor, 11, 120, 6);
    expect(indices.length).toBeGreaterThan(0);
  });
});
