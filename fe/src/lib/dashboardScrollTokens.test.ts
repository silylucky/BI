import { describe, expect, it } from "vitest";
import { DASHBOARD_SCROLL_CSS_VARS } from "./dashboardScrollTokens";

describe("dashboardScrollTokens", () => {
  it("T-SCROLL-01: white translucent thumb and transparent track", () => {
    expect(DASHBOARD_SCROLL_CSS_VARS["--dashboard-scroll-track"]).toBe("transparent");
    expect(DASHBOARD_SCROLL_CSS_VARS["--dashboard-scroll-thumb"]).toContain("255 255 255");
    expect(DASHBOARD_SCROLL_CSS_VARS["--dashboard-scroll-thumb"]).toContain("0.35");
  });
});
