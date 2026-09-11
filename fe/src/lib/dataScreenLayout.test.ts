import { describe, expect, it } from "vitest";
import {
  buildDefaultDataScreenLayout,
  dashboardPreviewPath,
  dashboardSharePath,
  dataScreenEmbedPath,
  dataScreenPreviewPath,
  ensureDataScreenStyleConfig,
  isDataScreenLayout,
  readSurfaceKind,
  resolvePersistedCanvasMinHeight,
} from "./dataScreenLayout";

describe("dataScreenLayout", () => {
  it("detects data-screen surface kind", () => {
    const layout = buildDefaultDataScreenLayout();
    expect(readSurfaceKind(layout)).toBe("data-screen");
    expect(isDataScreenLayout(layout)).toBe(true);
  });

  it("defaults to dashboard surface", () => {
    expect(readSurfaceKind({ styleConfig: {} })).toBe("dashboard");
    expect(isDataScreenLayout(undefined)).toBe(false);
  });

  it("reads surface kind from bare style config", () => {
    expect(readSurfaceKind({ surfaceKind: "data-screen" })).toBe("data-screen");
  });

  it("builds 1920x1080 dark canvas defaults", () => {
    const layout = buildDefaultDataScreenLayout();
    expect(layout.canvas.width).toBe(1920);
    expect(layout.canvas.height).toBe(1080);
    expect(layout.styleConfig?.colorScheme).toBe("dark");
  });

  it("resolves share paths by surface", () => {
    expect(dashboardSharePath("abc", true)).toBe("/admin/data-screens/abc/share");
    expect(dashboardSharePath("abc", false)).toBe("/admin/dashboards/abc/share");
  });

  it("resolves embed screen path", () => {
    expect(dataScreenEmbedPath("abc")).toBe("/embed/screen/abc");
  });

  it("resolves preview path for chromeless route", () => {
    expect(dataScreenPreviewPath("abc")).toBe("/admin/data-screens/abc/preview");
    expect(dashboardPreviewPath("abc")).toBe("/admin/dashboards/abc/preview");
  });

  it("resolves persisted canvas min height by surface", () => {
    expect(resolvePersistedCanvasMinHeight({ styleConfig: { surfaceKind: "data-screen" } })).toBe(
      1080,
    );
    expect(resolvePersistedCanvasMinHeight({ styleConfig: { surfaceKind: "dashboard" } })).toBe(
      900,
    );
  });

  it("ensures surfaceKind on screen saves", () => {
    expect(ensureDataScreenStyleConfig({ colorScheme: "dark" }, true)).toEqual({
      colorScheme: "dark",
      surfaceKind: "data-screen",
    });
    expect(ensureDataScreenStyleConfig({ colorScheme: "light" }, false)).toEqual({
      colorScheme: "light",
    });
  });
});
