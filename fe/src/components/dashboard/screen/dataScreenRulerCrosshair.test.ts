import { describe, expect, it } from "vitest";
import { formatDesignCoord, screenToDesignCoord } from "./dataScreenRulerCrosshair";

describe("screenToDesignCoord", () => {
  it("converts viewport pointer to design coordinates", () => {
    const coord = screenToDesignCoord({
      clientX: 150,
      clientY: 120,
      viewportRect: { left: 50, top: 40, width: 800, height: 600 },
      pan: { x: 10, y: 20 },
      offsetX: 0,
      offsetY: 0,
      scale: 0.5,
    });
    expect(coord).toEqual({ x: 180, y: 120 });
  });

  it("returns null when pointer is outside viewport", () => {
    expect(
      screenToDesignCoord({
        clientX: 10,
        clientY: 10,
        viewportRect: { left: 50, top: 40, width: 800, height: 600 },
        pan: { x: 0, y: 0 },
        offsetX: 0,
        offsetY: 0,
        scale: 1,
      }),
    ).toBeNull();
  });
});

describe("formatDesignCoord", () => {
  it("rounds coordinates for display", () => {
    expect(formatDesignCoord({ x: 123.6, y: 45.2 })).toBe("124, 45");
  });
});
