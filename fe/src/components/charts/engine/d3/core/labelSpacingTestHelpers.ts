import { expect } from "vitest";
import { anyBoxesOverlap, estimateLabelPixelWidth, type LabelBBox } from "./labelOverlap";
import { verticalLabelBandHeight } from "./nodeLabelThinning";

import { expect } from "vitest";
import { anyBoxesOverlap, anyVerticalBandsOverlap, estimateLabelPixelWidth, type LabelBBox } from "./labelOverlap";
import { verticalLabelBandHeight } from "./nodeLabelThinning";

export function assertVerticalLabelsNoOverlap(
  container: HTMLElement,
  selector: string,
  fontSize: number,
  minGapPx = 3,
): void {
  const half = verticalLabelBandHeight(fontSize) / 2;
  const bands = [...container.querySelectorAll(selector)].map((node) => {
    const y = Number(node.getAttribute("y") ?? 0);
    return { top: y - half, bottom: y + half };
  });
  expect(anyVerticalBandsOverlap(bands, minGapPx)).toBe(false);
}

export function assertTreemapVisibleLabelsNoOverlap(container: HTMLElement, fontSize: number): void {
  const boxes: LabelBBox[] = [];

  for (const cell of container.querySelectorAll("g.cell")) {
    const text = cell.querySelector("text");
    if (!text) continue;

    const transform = cell.getAttribute("transform") ?? "";
    const match = /translate\(([-\d.]+),([-\d.]+)\)/.exec(transform);
    if (!match) continue;

    const x0 = Number(match[1]);
    const y0 = Number(match[2]);
    const lines = [...text.querySelectorAll("tspan")].map((node) => node.textContent ?? "");
    if (lines.length === 0 && text.textContent) {
      lines.push(text.textContent);
    }
    if (lines.length === 0) continue;

    const lineHeight = Math.round(fontSize * 1.25);
    const labelHeight = lines.length * lineHeight;
    const labelWidth = Math.max(...lines.map((line) => estimateLabelPixelWidth(line, fontSize)), 0);
    boxes.push({
      left: x0 + 6,
      right: x0 + 6 + labelWidth,
      top: y0 + 4,
      bottom: y0 + 4 + labelHeight,
    });
  }

  expect(anyBoxesOverlap(boxes)).toBe(false);
}
