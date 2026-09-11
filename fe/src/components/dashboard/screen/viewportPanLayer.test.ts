import { describe, expect, it } from "vitest";
import {
  applyViewportPanLayerTransform,
  formatViewportPanTransform,
  hasExceededPanClickThreshold,
} from "./viewportPanLayer";

describe("viewportPanLayer", () => {
  it("formats translate with content offset", () => {
    expect(formatViewportPanTransform(12, 8, { x: 30, y: -20 })).toBe(
      "translate(42px, -12px)",
    );
  });

  it("writes transform to pan layer element", () => {
    const element = document.createElement("div");
    applyViewportPanLayerTransform(element, 0, 0, { x: 16, y: 24 });
    expect(element.style.transform).toBe("translate(16px, 24px)");
  });

  it("detects drag threshold for blank click vs pan", () => {
    expect(hasExceededPanClickThreshold(10, 10, 12, 10)).toBe(false);
    expect(hasExceededPanClickThreshold(10, 10, 16, 10)).toBe(true);
  });
});
