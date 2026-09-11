import { describe, expect, it } from "vitest";
import {
  resolveTableHostBorder,
  resolveTableHostOpacity,
  resolveTableScrollbarStyle,
} from "./chartSurfaceTheme";

describe("chartSurfaceTheme table chrome", () => {
  it("resolveTableHostOpacity returns ratio under 100%", () => {
    expect(resolveTableHostOpacity({ opacity: 80 })).toBe(0.8);
    expect(resolveTableHostOpacity({ opacity: 100 })).toBeUndefined();
  });

  it("resolveTableScrollbarStyle prefers explicit scrollbar color", () => {
    const style = resolveTableScrollbarStyle(
      { scrollbarColor: "#00ff00" },
      { "--dashboard-scroll-thumb": "#111111" },
    );
    expect(style?.["--dashboard-scroll-thumb" as keyof typeof style]).toBe("#00ff00");
  });

  it("resolveTableHostBorder falls back to theme token", () => {
    expect(resolveTableHostBorder()).toContain("--dashboard-table-border");
    expect(resolveTableHostBorder("#ff0000")).toBe("1px solid #ff0000");
  });
});
