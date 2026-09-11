import { describe, expect, it } from "vitest";
import { resolveWidgetShellOpacityFallback } from "./widgetSurfaceStyleFields";

describe("resolveWidgetShellOpacityFallback", () => {
  it("defaults dashboard shell opacity display to 100%", () => {
    expect(resolveWidgetShellOpacityFallback("dashboard")).toBe(100);
    expect(resolveWidgetShellOpacityFallback(undefined)).toBe(100);
  });

  it("defaults data-screen shell opacity display to 0%", () => {
    expect(resolveWidgetShellOpacityFallback("data-screen")).toBe(0);
  });
});
