import { describe, expect, it, beforeEach } from "vitest";
import {
  readPaletteCollapsed,
  readPaletteOpen,
  writePaletteCollapsed,
  writePaletteOpen,
} from "./dashboardPaletteCollapsed";

describe("dashboardPaletteCollapsed", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("defaults palette to open", () => {
    expect(readPaletteOpen()).toBe(true);
    expect(readPaletteCollapsed()).toBe(false);
  });

  it("persists palette open state", () => {
    writePaletteOpen(false);
    expect(readPaletteOpen()).toBe(false);
    writePaletteOpen(true);
    expect(readPaletteOpen()).toBe(true);
  });

  it("migrates legacy collapsed storage", () => {
    window.localStorage.setItem("vs:dashboard-palette-collapsed", "1");
    expect(readPaletteOpen()).toBe(false);
    writePaletteOpen(true);
    expect(window.localStorage.getItem("vs:dashboard-palette-collapsed")).toBeNull();
  });

  it("persists collapsed compat helpers", () => {
    writePaletteCollapsed(true);
    expect(readPaletteCollapsed()).toBe(true);
    writePaletteCollapsed(false);
    expect(readPaletteCollapsed()).toBe(false);
  });
});
