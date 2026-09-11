import { describe, expect, it } from "vitest";
import { normalizeHexColor } from "@/components/ui/color-field";
import {
  CANVAS_BG_DECOR_PRESETS,
  CANVAS_TILE_DECOR_PRESETS,
  canvasBackgroundStyle,
  decorPresetPreviewStyle,
  decorPresetThumbStyle,
  patchDecorNoneStyle,
  patchDecorPresetStyle,
  resolveArtboardStyle,
  resolveCanvasDecorPresetId,
  resolveCanvasDecorPresetIdForPanel,
} from "./dashboardStyleConfig";

describe("normalizeHexColor", () => {
  it("normalizes 3 and 6 digit hex", () => {
    expect(normalizeHexColor("#abc")).toBe("#aabbcc");
    expect(normalizeHexColor("#AABBCC")).toBe("#aabbcc");
  });

  it("rejects invalid input", () => {
    expect(normalizeHexColor("123")).toBeNull();
    expect(normalizeHexColor("red")).toBeNull();
  });
});

describe("resolveCanvasDecorPresetIdForPanel", () => {
  it("maps legacy gradient decor to none for panel selection", () => {
    expect(
      resolveCanvasDecorPresetIdForPanel({
        canvasDecorPresetId: "gradient-radial",
        canvasBackgroundCustom: true,
        canvasBackground: "radial-gradient(ellipse 90% 70% at 50% -10%, #312e81 0%, #0f172a 55%, #020617 100%)",
      }),
    ).toBe("none");
  });
});

describe("CANVAS_TILE_DECOR_PRESETS", () => {
  it("excludes gradient presets from panel list", () => {
    expect(CANVAS_TILE_DECOR_PRESETS.map((item) => item.id)).toEqual([
      "none",
      "dots",
      "grid",
      "cross",
      "diagonal",
    ]);
    expect(CANVAS_TILE_DECOR_PRESETS).toHaveLength(5);
  });
});

describe("resolveCanvasDecorPresetId", () => {
  it("detects gradient and custom image", () => {
    expect(
      resolveCanvasDecorPresetId({
        canvasBackground: "linear-gradient(160deg, #fff, #000)",
        canvasBackgroundCustom: true,
      }),
    ).toBe("gradient-soft");
    expect(
      resolveCanvasDecorPresetId({
        canvasBackgroundImage: "https://cdn.example.com/bg.png",
      }),
    ).toBe("custom");
  });

  it("detects dots preset image", () => {
    const dots = CANVAS_BG_DECOR_PRESETS.find((item) => item.id === "dots");
    expect(
      resolveCanvasDecorPresetId({
        canvasBackgroundImage: dots?.image,
      }),
    ).toBe("dots");
  });
});

describe("canvasBackgroundStyle decor tiles", () => {
  it("repeats dots/grid with solid fill instead of cover", () => {
    const dots = CANVAS_BG_DECOR_PRESETS.find((item) => item.id === "dots");
    expect(
      canvasBackgroundStyle({ canvasBackgroundImage: dots?.image, colorScheme: "light" }),
    ).toEqual({
      backgroundColor: "#f8fafc",
      backgroundImage: expect.stringMatching(/^url\("data:image\/svg\+xml,/),
      backgroundSize: "16px 16px",
      backgroundRepeat: "repeat",
    });
  });

  it("uses theme-aware tile on dark scheme", () => {
    const dots = CANVAS_BG_DECOR_PRESETS.find((item) => item.id === "dots");
    const style = canvasBackgroundStyle({
      canvasBackgroundImage: dots?.image,
      colorScheme: "dark",
      canvasBackgroundCustom: true,
      canvasBackground: "#0f172a",
    });
    expect(style.backgroundColor).toBe("#0f172a");
    expect(style.backgroundImage).toContain("94a3b8");
    expect(style.backgroundSize).toBe("16px 16px");
  });

  it("resolveArtboardStyle keeps decor tiles on dark scheme", () => {
    const patched = patchDecorPresetStyle("dots", { colorScheme: "dark" });
    const style = resolveArtboardStyle({
      colorScheme: "dark",
      ...patched,
    });
    expect(style.backgroundImage).toContain("url(");
    expect(style.backgroundSize).toBe("16px 16px");
  });
});

describe("patchDecorPresetStyle", () => {
  it("only sets tile image when picking dots without custom color", () => {
    expect(patchDecorPresetStyle("dots", { colorScheme: "dark" })).toEqual({
      canvasBackgroundImage: expect.stringContaining("data:image/svg+xml"),
      canvasDecorPresetId: "dots",
      chrome: { showAuxiliaryGrid: false },
    });
  });

  it("preserves user solid underlay when applying tile decor", () => {
    expect(
      patchDecorPresetStyle("grid", {
        colorScheme: "dark",
        canvasBackground: "#7556b8",
        canvasBackgroundCustom: true,
        chrome: { showAuxiliaryGrid: true, showChartActionButtons: true },
      }),
    ).toEqual({
      canvasBackgroundImage: expect.stringContaining("data:image/svg+xml"),
      canvasBackground: "#7556b8",
      canvasBackgroundCustom: true,
      canvasDecorPresetId: "grid",
      chrome: { showAuxiliaryGrid: false, showChartActionButtons: true },
    });
  });

  it("does not toggle auxiliary grid when clearing to none", () => {
    expect(
      patchDecorPresetStyle("none", {
        canvasDecorPresetId: "dots",
        chrome: { showAuxiliaryGrid: true },
      }),
    ).toEqual({
      canvasBackgroundImage: undefined,
      canvasDecorPresetId: undefined,
    });
  });

  it("thumb preview uses underlay and tile repeat", () => {
    const thumb = decorPresetThumbStyle("dots", "dark", "#7556b8");
    expect(thumb.backgroundColor).toBe("#7556b8");
    expect(thumb.backgroundImage).toContain("url(");
    expect(thumb.backgroundRepeat).toBe("repeat");
  });

  it("preview styles differ between none and dots", () => {
    const none = decorPresetPreviewStyle("none", "light");
    const dots = decorPresetPreviewStyle("dots", "light");
    expect(none.backgroundColor).toBe("#ffffff");
    expect(dots.backgroundImage).toContain("url(");
  });
});

describe("patchDecorNoneStyle", () => {
  it("clears image and legacy gradient-soft preset background", () => {
    expect(
      patchDecorNoneStyle({
        canvasBackground:
          "linear-gradient(160deg, #eff6ff 0%, #f8fafc 45%, #fef3c7 100%)",
        canvasDecorPresetId: "gradient-soft",
        canvasBackgroundCustom: true,
      }),
    ).toEqual({
      canvasBackgroundImage: undefined,
      canvasDecorPresetId: undefined,
      canvasBackground: undefined,
      canvasBackgroundCustom: false,
    });
  });

  it("keeps custom solid color when clearing decor", () => {
    expect(
      patchDecorNoneStyle({
        canvasBackground: "#57617a",
        canvasBackgroundCustom: true,
        canvasBackgroundImage: CANVAS_BG_DECOR_PRESETS.find((item) => item.id === "dots")?.image,
        canvasDecorPresetId: "dots",
      }),
    ).toEqual({
      canvasBackgroundImage: undefined,
      canvasDecorPresetId: undefined,
    });
  });
});
