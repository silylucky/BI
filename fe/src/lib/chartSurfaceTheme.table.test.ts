import { describe, expect, it } from "vitest";
import { applyColorAlpha, softenTableChromeBg } from "./tableColorAlpha";
import { resolveTableThemeVars } from "./chartSurfaceTheme";

describe("tableColorAlpha", () => {
  it("applyColorAlpha scales rgba alpha", () => {
    expect(applyColorAlpha("rgba(255, 0, 0, 0.8)", 0.5)).toBe("rgba(255, 0, 0, 0.4)");
  });

  it("softenTableChromeBg uses color-mix", () => {
    expect(softenTableChromeBg("#f9fafb")).toContain("color-mix");
    expect(softenTableChromeBg("#f9fafb")).toContain("#f9fafb");
  });
});

describe("resolveTableThemeVars chrome transparency", () => {
  it("softens header/footer and body when body background is unset", () => {
    const vars = resolveTableThemeVars({}, { colorScheme: "light" });
    expect(vars["--dashboard-table-header-bg"]).toContain("color-mix");
    expect(vars["--dashboard-table-footer-bg"]).toContain("color-mix");
    expect(vars["--dashboard-table-body-bg"]).toContain("color-mix");
    expect(vars["--dashboard-table-column-bg"]).toContain("color-mix");
  });

  it("applies header and body font size CSS vars", () => {
    const vars = resolveTableThemeVars(
      { headerFontSize: 16, bodyFontSize: 18 },
      { colorScheme: "light" },
    );
    expect(vars["--dashboard-table-header-font-size"]).toBe("16px");
    expect(vars["--dashboard-table-body-font-size"]).toBe("18px");
  });
});
