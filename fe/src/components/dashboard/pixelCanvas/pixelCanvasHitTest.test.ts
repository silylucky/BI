import { describe, expect, it } from "vitest";
import { isPixelCanvasWidgetTarget } from "./pixelCanvasHitTest";

describe("isPixelCanvasWidgetTarget", () => {
  it("returns true for elements inside pixel shape", () => {
    const host = document.createElement("div");
    host.className = "pixel-shape-outer";
    const button = document.createElement("button");
    host.appendChild(button);
    document.body.appendChild(host);

    expect(isPixelCanvasWidgetTarget(button)).toBe(true);
    host.remove();
  });

  it("returns false for unrelated elements", () => {
    const el = document.createElement("div");
    expect(isPixelCanvasWidgetTarget(el)).toBe(false);
  });
});
