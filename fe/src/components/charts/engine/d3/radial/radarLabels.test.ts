import { describe, expect, it } from "vitest";
import {
  layoutRadarAxisLabelIndices,
  layoutRadarPointLabelKeys,
  radarAxisLabelBboxes,
} from "./radarLabels";
import { boxesOverlap } from "@/components/charts/engine/d3/core/labelOverlap";

describe("radarLabels", () => {
  it("thins 35 long date outer axis labels", () => {
    const count = 35;
    const texts = Array.from({ length: count }, (_, i) => {
      const day = String(i + 1).padStart(2, "0");
      return `2025-01-${day}`;
    });
    const angles = Array.from({ length: count }, (_, i) => (i / count) * Math.PI * 2 - Math.PI / 2);
    const labelR = 120;
    const fontSize = 11;
    const indices = layoutRadarAxisLabelIndices(texts, angles, labelR, fontSize);
    expect(indices.length).toBeGreaterThan(1);
    expect(indices.length).toBeLessThan(count);

    const boxes = radarAxisLabelBboxes(indices, texts, angles, labelR, fontSize);
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        expect(boxesOverlap(boxes[i]!, boxes[j]!)).toBe(false);
      }
    }
  });

  it("thins crowded short outer axis labels without overlap", () => {
    const count = 12;
    const texts = Array.from({ length: count }, (_, i) => `维度${i}`);
    const angles = Array.from({ length: count }, (_, i) => (i / count) * Math.PI * 2 - Math.PI / 2);
    const labelR = 120;
    const fontSize = 11;
    const indices = layoutRadarAxisLabelIndices(texts, angles, labelR, fontSize);
    expect(indices.length).toBeGreaterThan(0);
    expect(indices.length).toBeLessThanOrEqual(count);

    const boxes = radarAxisLabelBboxes(indices, texts, angles, labelR, fontSize);
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        expect(boxesOverlap(boxes[i]!, boxes[j]!)).toBe(false);
      }
    }
  });

  it("skips overlapping point labels by priority", () => {
    const items = [
      { key: "a", text: "2025-01-01 9,999", px: 2, py: 2, angle: 0.1, priority: 9999 },
      { key: "b", text: "2025-01-02 8,888", px: 4, py: 3, angle: 0.15, priority: 100 },
      { key: "c", text: "99", px: 80, py: 0, angle: 0, priority: 50 },
    ];
    const visible = layoutRadarPointLabelKeys(items, 11);
    expect(visible.has("a")).toBe(true);
    expect(visible.has("c")).toBe(true);
    expect(visible.has("b")).toBe(false);
  });
});
