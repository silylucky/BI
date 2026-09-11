import { afterEach, describe, expect, it, vi } from "vitest";
import { markAdminNavShellReady, markAdminNavStart } from "./adminNavPerf";

describe("adminNavPerf", () => {
  afterEach(() => {
    performance.clearMarks();
    performance.clearMeasures();
  });

  it("records shell timing measure when start mark exists", () => {
    markAdminNavStart("/admin/dashboards");
    markAdminNavShellReady("/admin/dashboards");
    const measures = performance.getEntriesByType("measure");
    expect(measures.some((entry) => entry.name.includes("/admin/dashboards"))).toBe(true);
  });

  it("does not throw when shell ready without start mark", () => {
    expect(() => markAdminNavShellReady("/admin/datasets")).not.toThrow();
  });
});

describe("adminNavPerf dev logging", () => {
  it("logs shell duration in dev", () => {
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    markAdminNavStart("/admin/viz-templates");
    markAdminNavShellReady("/admin/viz-templates");
    if (import.meta.env.DEV) {
      expect(debugSpy).toHaveBeenCalled();
    }
    debugSpy.mockRestore();
  });
});
