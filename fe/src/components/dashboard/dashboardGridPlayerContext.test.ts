import { describe, expect, it } from "vitest";
import { resolveChartMountPriority } from "./dashboardGridPlayerContext";

describe("resolveChartMountPriority", () => {
  it("uses selected widget when grid is idle", () => {
    expect(resolveChartMountPriority("a", true, "grid", null)).toBe(0);
    expect(resolveChartMountPriority("b", false, "grid", null)).toBe(1);
  });

  it("gives playing widget priority 0 during grid drag even if not selected", () => {
    expect(resolveChartMountPriority("dragging", false, "grid", "dragging")).toBe(0);
    expect(resolveChartMountPriority("selected", true, "grid", "dragging")).toBe(1);
  });

  it("ignores grid playing state on pixel shape shell", () => {
    expect(resolveChartMountPriority("a", true, "shape", "b")).toBe(0);
    expect(resolveChartMountPriority("b", false, "shape", "b")).toBe(1);
  });
});
