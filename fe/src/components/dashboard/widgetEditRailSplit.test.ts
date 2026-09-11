import { describe, expect, it } from "vitest";
import {
  clampWidgetEditRailLeftRatio,
  WIDGET_EDIT_RAIL_DEFAULT_LEFT_RATIO,
} from "./widgetEditRailSplit";

describe("widgetEditRailSplit", () => {
  it("clamps left ratio within min column widths", () => {
    const width = 432;
    expect(clampWidgetEditRailLeftRatio(0.1, width)).toBeGreaterThan(0.3);
    expect(clampWidgetEditRailLeftRatio(0.95, width)).toBeLessThan(0.75);
    expect(clampWidgetEditRailLeftRatio(0.55, width)).toBeCloseTo(0.55, 2);
  });

  it("falls back to default ratio for invalid container width", () => {
    expect(clampWidgetEditRailLeftRatio(0.4, 0)).toBe(WIDGET_EDIT_RAIL_DEFAULT_LEFT_RATIO);
  });
});
