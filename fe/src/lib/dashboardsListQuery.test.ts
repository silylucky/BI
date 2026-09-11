import { describe, expect, it } from "vitest";
import { buildDashboardsListUrl } from "./dashboardsListQuery";

describe("buildDashboardsListUrl", () => {
  it("appends surfaceKind when provided", () => {
    expect(
      buildDashboardsListUrl({ limit: 20, offset: 0, surfaceKind: "data-screen" }),
    ).toBe("/api/v1/dashboards?limit=20&offset=0&surfaceKind=data-screen");
  });

  it("omits surfaceKind for unfiltered list", () => {
    expect(buildDashboardsListUrl({ limit: 50, offset: 10 })).toBe(
      "/api/v1/dashboards?limit=50&offset=10",
    );
  });

  it("appends q when provided", () => {
    expect(
      buildDashboardsListUrl({ limit: 20, offset: 0, surfaceKind: "dashboard", q: "销售" }),
    ).toBe("/api/v1/dashboards?limit=20&offset=0&surfaceKind=dashboard&q=%E9%94%80%E5%94%AE");
  });
});
