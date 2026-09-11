import { describe, expect, it } from "vitest";
import {
  clampDashboardEditRailWidth,
  resolveDashboardEditRailWidthOnDrag,
  DASHBOARD_EDIT_RAIL_WIDTH_PX,
} from "./dashboardEditRailLayout";

describe("dashboardEditRailLayout width", () => {
  it("clamps rail shell width within min/max and viewport", () => {
    expect(clampDashboardEditRailWidth(200, 1280)).toBeGreaterThanOrEqual(300);
    expect(clampDashboardEditRailWidth(2000, 1280)).toBeLessThanOrEqual(720);
    expect(clampDashboardEditRailWidth(432, 1280)).toBe(DASHBOARD_EDIT_RAIL_WIDTH_PX);
  });

  it("widens rail when dragging separator left", () => {
    expect(resolveDashboardEditRailWidthOnDrag(432, -40, 1280)).toBe(472);
    expect(resolveDashboardEditRailWidthOnDrag(432, 40, 1280)).toBe(392);
  });
});
