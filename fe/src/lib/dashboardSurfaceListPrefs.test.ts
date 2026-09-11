import { afterEach, describe, expect, it } from "vitest";
import {
  readDashboardSurfaceListViewMode,
  writeDashboardSurfaceListViewMode,
} from "./dashboardSurfaceListPrefs";

describe("dashboardSurfaceListPrefs", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("defaults to grid when unset", () => {
    expect(readDashboardSurfaceListViewMode("dashboard")).toBe("grid");
    expect(readDashboardSurfaceListViewMode("data-screen")).toBe("grid");
  });

  it("persists view mode per surface", () => {
    writeDashboardSurfaceListViewMode("dashboard", "list");
    writeDashboardSurfaceListViewMode("data-screen", "grid");
    expect(readDashboardSurfaceListViewMode("dashboard")).toBe("list");
    expect(readDashboardSurfaceListViewMode("data-screen")).toBe("grid");
  });
});
