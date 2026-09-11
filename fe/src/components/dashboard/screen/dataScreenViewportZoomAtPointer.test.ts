import { describe, expect, it } from "vitest";
import { computePanForZoomAtPointer } from "./dataScreenViewportZoomAtPointer";

describe("computePanForZoomAtPointer", () => {
  const base = {
    pan: { x: 0, y: 0 },
    offsetX: 0,
    offsetY: 0,
    baseScale: 0.5,
    oldZoom: 1,
  };

  it("keeps design point under pointer when zooming in", () => {
    const pointerX = 200;
    const pointerY = 150;
    const newZoom = 1.5;
    const pan = computePanForZoomAtPointer({
      ...base,
      pointerX,
      pointerY,
      newZoom,
    });
    const designBeforeX = (pointerX - base.pan.x) / (base.baseScale * base.oldZoom);
    const designAfterX = (pointerX - pan.x) / (base.baseScale * newZoom);
    expect(designAfterX).toBeCloseTo(designBeforeX, 5);
  });

  it("compensates pan when offset is non-zero", () => {
    const pan = computePanForZoomAtPointer({
      pan: { x: 40, y: 20 },
      offsetX: 80,
      offsetY: 60,
      baseScale: 1,
      oldZoom: 1,
      newZoom: 2,
      pointerX: 300,
      pointerY: 200,
    });
    const designBefore = (300 - 80 - 40) / 1;
    const designAfter = (300 - 80 - pan.x) / 2;
    expect(designAfter).toBeCloseTo(designBefore, 5);
  });

  it("returns unchanged pan when scale is zero", () => {
    const pan = { x: 10, y: 20 };
    expect(
      computePanForZoomAtPointer({
        pointerX: 100,
        pointerY: 100,
        pan,
        offsetX: 0,
        offsetY: 0,
        baseScale: 0,
        oldZoom: 1,
        newZoom: 2,
      }),
    ).toEqual(pan);
  });
});
