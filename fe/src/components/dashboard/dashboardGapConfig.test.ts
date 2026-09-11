import { describe, expect, it } from "vitest";
import { buildDashboardLayoutForSave } from "./dashboardCanvasMode";
import {
  buildDashboardGapPatch,
  DEFAULT_CUSTOM_GRID_GAP,
  DEFAULT_CUSTOM_PIXEL_GAP,
  GAP_PRESET_PX,
  normalizeDashboardGapConfig,
  PIXEL_GAP_PRESET_PX,
  resolveDashboardComponentGap,
  resolveDashboardGapUiState,
} from "./dashboardStyleConfig";

describe("dashboard gap custom mode", () => {
  it("keeps custom preset when gapPreset is custom even if px matches md", () => {
    const ui = resolveDashboardGapUiState(
      { gapPreset: "custom", pixelGutter: 5 },
      { pixel: true },
    );
    expect(ui.preset).toBe("custom");
    expect(ui.hasGap).toBe(true);
  });

  it("selecting custom from md uses non-preset default px for pixel layout", () => {
    const patch = buildDashboardGapPatch(
      { gapPreset: "md", pixelGutter: 5, widgetGap: 8 },
      { type: "preset", preset: "custom" },
      { pixel: true },
    );
    expect(patch.gapPreset).toBe("custom");
    expect(patch.pixelGutter).toBe(DEFAULT_CUSTOM_PIXEL_GAP);
    expect(patch.widgetGap).toBe(DEFAULT_CUSTOM_GRID_GAP);
    expect(resolveDashboardGapUiState({ ...patch }, { pixel: true }).preset).toBe("custom");
  });

  it("custom px patch resolves to canvas gap", () => {
    const patch = buildDashboardGapPatch({}, { type: "customPx", px: 7 }, { pixel: true });
    expect(patch).toEqual({ gapPreset: "custom", pixelGutter: 7, widgetGap: 7 });
    expect(resolveDashboardComponentGap(patch, { pixel: true })).toBe(7);
  });

  it("pixel custom slider allows up to PIXEL_GAP_CUSTOM_MAX", async () => {
    const { PIXEL_GAP_CUSTOM_MAX } = await import("./gapPolicy");
    expect(PIXEL_GAP_CUSTOM_MAX).toBe(24);
    const patch = buildDashboardGapPatch({}, { type: "customPx", px: 20 }, { pixel: true });
    expect(patch.pixelGutter).toBe(20);
    expect(resolveDashboardGapUiState({ ...patch }, { pixel: true }).customMax).toBe(24);
  });

  it("custom px zero clears gap via none preset", () => {
    expect(buildDashboardGapPatch({}, { type: "customPx", px: 0 }, { pixel: true })).toEqual({
      gapPreset: "none",
      pixelGutter: 0,
      widgetGap: 0,
    });
  });

  it("toggle off clears both gap channels", () => {
    expect(
      buildDashboardGapPatch(
        { gapPreset: "md", widgetGap: 8, pixelGutter: 5 },
        { type: "toggle", hasGap: false },
      ),
    ).toEqual({
      gapPreset: "none",
      pixelGutter: 0,
      widgetGap: 0,
    });
  });

  it("toggle on writes both channels for md preset", () => {
    expect(buildDashboardGapPatch({}, { type: "toggle", hasGap: true })).toEqual({
      gapPreset: "md",
      widgetGap: GAP_PRESET_PX.md,
      pixelGutter: PIXEL_GAP_PRESET_PX.md,
    });
  });

  it("empty config resolves to zero gap until user enables it", () => {
    expect(resolveDashboardComponentGap({})).toBe(0);
    expect(resolveDashboardComponentGap({}, { pixel: true })).toBe(0);
    expect(resolveDashboardGapUiState({}, { pixel: true }).hasGap).toBe(false);
  });

  it("normalizeDashboardGapConfig writes explicit none when gap is zero", () => {
    expect(normalizeDashboardGapConfig({ colorScheme: "dark" })).toEqual({
      colorScheme: "dark",
      gapPreset: "none",
      pixelGutter: 0,
      widgetGap: 0,
    });
    expect(normalizeDashboardGapConfig({ gapPreset: "none", pixelGutter: 0 })).toEqual({
      gapPreset: "none",
      pixelGutter: 0,
      widgetGap: 0,
    });
  });

  it("legacy widgetGap-only keeps pixel shell at none (grid field does not imply pixel gutter)", () => {
    expect(normalizeDashboardGapConfig({ widgetGap: 8 })).toEqual({
      gapPreset: "none",
      widgetGap: 8,
      pixelGutter: 0,
    });
  });

  it("resolvePixelGutter does not infer from legacy widgetGap", async () => {
    const { resolvePixelGutter } = await import("./gapPolicy");
    expect(resolvePixelGutter({ widgetGap: 8 })).toBe(0);
  });

  it("bootstrap aligns runtime pixel gap with save normalization", async () => {
    const { bootstrapDashboardStyleConfig } = await import("./dashboardThemeVariants");
    const { resolveComponentGapRuntime } = await import("./componentGapRuntime");
    const bootstrapped = bootstrapDashboardStyleConfig({ widgetGap: 8 });
    const saved = buildDashboardLayoutForSave(
      { version: 2, canvas: { width: 1440, height: 900 }, widgets: [] },
      bootstrapped,
    );
    expect(resolveComponentGapRuntime(bootstrapped, "pixel").shellPaddingPx).toBe(0);
    expect(resolveComponentGapRuntime(saved.styleConfig ?? {}, "pixel").shellPaddingPx).toBe(0);
  });

  it("buildDashboardLayoutForSave normalizes legacy widgetGap without pixel gutter", () => {
    const saved = buildDashboardLayoutForSave(
      { version: 2, canvas: { width: 1440, height: 900 }, widgets: [] },
      { widgetGap: 8 },
    );
    expect(saved.styleConfig?.gapPreset).toBe("none");
    expect(saved.styleConfig?.widgetGap).toBe(0);
    expect(saved.styleConfig?.pixelGutter).toBe(0);
  });
});
