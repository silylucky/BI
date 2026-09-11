import { describe, expect, it } from "vitest";
import {
  hasUserCanvasBackground,
  materializeDecorStyleConfig,
  patchDecorPresetStyle,
  resolveArtboardStyle,
  resolveCanvasDecorPresetId,
} from "./dashboardStyleConfig";
import {
  applyDashboardStylePatch,
  bootstrapDashboardStyleConfig,
  resetDashboardColorsToActiveThemeBundle,
} from "./dashboardThemeVariants";
import { hydrateDashboardStyle } from "./stylePipeline";

describe("canvas background edit pipeline", () => {
  it("preserves decor patch through patch + hydrate roundtrip", () => {
    const base = bootstrapDashboardStyleConfig({ colorScheme: "light" });
    const patch = patchDecorPresetStyle("dots", base);
    const { styleConfig: patched } = applyDashboardStylePatch(base, [], patch);
    const hydrated = hydrateDashboardStyle(patched);

    expect(hasUserCanvasBackground(hydrated)).toBe(true);
    expect(hydrated.canvasDecorPresetId).toBe("dots");
    expect(resolveArtboardStyle(hydrated).backgroundImage).toContain("url(");
  });

  it("preserves solid color patch through hydrate", () => {
    const base = bootstrapDashboardStyleConfig({ colorScheme: "light" });
    const { styleConfig: patched } = applyDashboardStylePatch(base, [], {
      canvasBackground: "#eff6ff",
      canvasBackgroundCustom: true,
    });
    const hydrated = hydrateDashboardStyle(patched);

    expect(hasUserCanvasBackground(hydrated)).toBe(true);
    expect(resolveArtboardStyle(hydrated).background).toBe("#eff6ff");
  });

  it("dark theme decor remains renderable after hydrate (panel id vs canvas)", () => {
    const base = bootstrapDashboardStyleConfig({ colorScheme: "dark" });
    const patch = patchDecorPresetStyle("dots", base);
    const { styleConfig: patched } = applyDashboardStylePatch(base, [], patch);
    const hydrated = hydrateDashboardStyle(patched);

    expect(resolveCanvasDecorPresetId(patched)).toBe("dots");
    expect(hasUserCanvasBackground(hydrated)).toBe(true);
    expect(resolveArtboardStyle(hydrated).backgroundImage).toContain("url(");
  });

  it("hydrate merges root custom canvas when themeVariants snapshot is stale", () => {
    const base = bootstrapDashboardStyleConfig({ colorScheme: "light" });
    const decor = patchDecorPresetStyle("dots", base);
    const stale = { ...base, ...decor };
    expect(resolveCanvasDecorPresetId(stale)).toBe("dots");

    const hydrated = hydrateDashboardStyle(stale);
    expect(hasUserCanvasBackground(hydrated)).toBe(true);
    expect(resolveArtboardStyle(hydrated).backgroundImage).toContain("url(");
  });

  it("dark theme custom purple survives hydrate", () => {
    const base = bootstrapDashboardStyleConfig({ colorScheme: "dark" });
    const { styleConfig: patched } = applyDashboardStylePatch(base, [], {
      canvasBackground: "#7556b8",
      canvasBackgroundCustom: true,
    });
    const hydrated = hydrateDashboardStyle(patched);
    expect(resolveArtboardStyle(hydrated).background).toBe("#7556b8");
  });

  it("seed layout with decor id only materializes gradient background on hydrate", () => {
    const seeded = {
      surfaceKind: "data-screen" as const,
      colorScheme: "dark" as const,
      canvasDecorPresetId: "gradient-radial" as const,
    };
    expect(seeded.canvasBackground).toBeUndefined();

    const hydrated = hydrateDashboardStyle(seeded);
    expect(hydrated.canvasBackgroundCustom).toBe(true);
    expect(hydrated.canvasBackground).toContain("radial-gradient");
    expect(hasUserCanvasBackground(hydrated)).toBe(true);
    expect(resolveArtboardStyle(hydrated).background).toContain("radial-gradient");
  });

  it("materializeDecorStyleConfig leaves custom image backgrounds untouched", () => {
    const withImage = materializeDecorStyleConfig({
      colorScheme: "dark",
      canvasBackgroundCustom: true,
      canvasBackground: "#0f172a",
      canvasBackgroundImage: "/template-assets/backgrounds/screen-gov-indigo.svg",
      canvasDecorPresetId: "gradient-soft",
    });
    expect(withImage.canvasBackgroundImage).toBe(
      "/template-assets/backgrounds/screen-gov-indigo.svg",
    );
  });

  it("preserves uploaded data URL through patch + hydrate", () => {
    const dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const base = bootstrapDashboardStyleConfig({ colorScheme: "light" });
    const { styleConfig: patched } = applyDashboardStylePatch(base, [], {
      canvasBackgroundImage: dataUrl,
      canvasBackgroundCustom: true,
      canvasDecorPresetId: "custom",
    });
    const hydrated = hydrateDashboardStyle(patched);
    expect(hydrated.canvasBackgroundImage).toBe(dataUrl);
    expect(hydrated.canvasDecorPresetId).toBe("custom");
  });

  it("keeps tile decor image after repeated hydrate (layout commit path)", () => {
    const base = hydrateDashboardStyle({ colorScheme: "light" });
    const { styleConfig: withSolid } = applyDashboardStylePatch(base, [], {
      canvasBackground: "#eff6ff",
      canvasBackgroundCustom: true,
    });
    const decorPatch = patchDecorPresetStyle("dots", withSolid);
    const { styleConfig: withDecor } = applyDashboardStylePatch(withSolid, [], decorPatch);
    const once = hydrateDashboardStyle(withDecor);
    expect(once.canvasDecorPresetId).toBe("dots");
    expect(once.canvasBackgroundImage).toContain("data:image/svg+xml");

    // 松手改布局会再次 resolveEffective → hydrate；须幂等保留纹理
    const twice = hydrateDashboardStyle(once);
    expect(twice.canvasDecorPresetId).toBe("dots");
    expect(twice.canvasBackgroundImage).toContain("data:image/svg+xml");
    expect(resolveArtboardStyle(twice).backgroundImage).toContain("url(");
  });

  it("rematerializes missing tile image when custom solid + decor id remain", () => {
    const restored = materializeDecorStyleConfig({
      colorScheme: "light",
      canvasBackground: "#eff6ff",
      canvasBackgroundCustom: true,
      canvasDecorPresetId: "grid",
    });
    expect(restored.canvasBackgroundImage).toContain("data:image/svg+xml");
    expect(resolveArtboardStyle(restored).backgroundImage).toContain("url(");
  });

  it("reset + hydrate clears custom canvas image from artboard style", () => {
    const base = hydrateDashboardStyle({
      colorScheme: "dark",
      canvasBackgroundCustom: true,
      canvasBackground:
        "radial-gradient(ellipse 100% 85% at 50% -5%, #22d3ee40 0%, #0f172a 42%, #020617 100%)",
      canvasBackgroundImage:
        "/template-assets/packs/gov-enterprise-v1/backgrounds/dark/canvas-dark-cyan-command.svg",
      widgetStyle: { opacity: 0, background: "#1e293b" },
    });
    const { styleConfig } = resetDashboardColorsToActiveThemeBundle(base, []);
    const hydrated = hydrateDashboardStyle(styleConfig);
    expect(hydrated.canvasBackgroundImage).toBeUndefined();
    expect(resolveArtboardStyle(hydrated).backgroundImage).toBeUndefined();
  });
});
