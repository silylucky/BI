import { describe, expect, it } from "vitest";
import { shouldApplyPropsRectToDisplay } from "./pixelShapePropsSync";

const base = { x: 0, y: 0, width: 300, height: 200 };

describe("shouldApplyPropsRectToDisplay", () => {
  it("allows sync when display already matches props", () => {
    expect(shouldApplyPropsRectToDisplay(base, base, null)).toBe(true);
  });

  it("blocks stomp when display is ahead of stale props", () => {
    const display = { x: 120, y: 80, width: 300, height: 200 };
    expect(shouldApplyPropsRectToDisplay(display, base, base)).toBe(false);
  });

  it("allows external layout change when display still reflects last synced props", () => {
    const synced = { x: 120, y: 80, width: 300, height: 200 };
    const next = { x: 40, y: 40, width: 300, height: 200 };
    expect(shouldApplyPropsRectToDisplay(synced, next, synced)).toBe(true);
  });
});
