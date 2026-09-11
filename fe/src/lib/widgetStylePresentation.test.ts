import { describe, expect, it } from "vitest";
import { buildWidgetBackgroundPresentation } from "./widgetStylePresentation";

describe("buildWidgetBackgroundPresentation", () => {
  it("applies frameOpacity only to decorative frame layer", () => {
    const presentation = buildWidgetBackgroundPresentation(
      {
        backgroundShow: true,
        backgroundMode: "frame",
        framePresetId: "frame-1",
        frameColor: "#465fff",
        background: "#ffffff",
        opacity: 0.4,
        frameOpacity: 0.8,
      },
      "light",
    );
    expect(presentation.frameLayer?.opacity).toBe(0.8);
    expect(presentation.frameLayer?.opacity).not.toBe(presentation.backgroundLayer?.opacity);
  });

  it("keeps decorative frame fully opaque when frameOpacity unset (ignores background opacity)", () => {
    const presentation = buildWidgetBackgroundPresentation(
      {
        backgroundShow: true,
        backgroundMode: "frame",
        framePresetId: "frame-1",
        opacity: 0.5,
      },
      "light",
    );
    expect(presentation.frameLayer?.opacity).toBe(1);
    expect(presentation.frameLayer?.transform).toContain("translateZ");
  });

  it("uses transparent shell surface when background image is active", () => {
    const presentation = buildWidgetBackgroundPresentation(
      {
        backgroundShow: true,
        backgroundMode: "image",
        backgroundImage: "https://example.com/bg.png",
      },
      "light",
    );
    expect(presentation.surface.backgroundColor).toBe("transparent");
    expect(presentation.backgroundLayer?.backgroundImage).toContain('url("https://example.com/bg.png")');
    expect(presentation.backgroundLayer?.backgroundSize).toBe("100% 100%");
  });

  it("creates image layer when backgroundImage coexists with framePresetId and no explicit mode", () => {
    const presentation = buildWidgetBackgroundPresentation(
      {
        backgroundShow: true,
        backgroundImage: "https://example.com/bg.png",
        framePresetId: "frame-1",
      },
      "light",
    );
    expect(presentation.backgroundLayer?.backgroundImage).toContain("example.com/bg.png");
    expect(presentation.frameLayer).toBeNull();
  });

  it("does not inherit shell opacity onto image layer when backgroundImageOpacity unset", () => {
    const presentation = buildWidgetBackgroundPresentation(
      {
        backgroundShow: true,
        backgroundMode: "image",
        backgroundImage: "https://example.com/bg.png",
        opacity: 0,
      },
      "light",
    );
    expect(presentation.backgroundLayer?.opacity).toBeUndefined();
  });

  it("applies backgroundImageOpacity only to image layer", () => {
    const presentation = buildWidgetBackgroundPresentation(
      {
        backgroundShow: true,
        backgroundMode: "image",
        backgroundImage: "https://example.com/bg.png",
        opacity: 0,
        backgroundImageOpacity: 0.5,
      },
      "light",
    );
    expect(presentation.backgroundLayer?.opacity).toBe(0.5);
  });

  it("uses transparent shell surface when backgroundShow is false even with color set", () => {
    const presentation = buildWidgetBackgroundPresentation(
      {
        backgroundShow: false,
        background: "#613e3e",
      },
      "light",
    );
    expect(presentation.surface.backgroundColor).toBe("transparent");
    expect(presentation.backgroundLayer).toBeNull();
  });

  it("uses widthFit layer style for decor backgrounds", () => {
    const presentation = buildWidgetBackgroundPresentation(
      {
        backgroundShow: true,
        backgroundMode: "image",
        backgroundImage:
          "/template-assets/packs/borderless-decor-v1/items/decor-bow-deep-cyan.svg",
        backgroundImageFit: "widthFit",
        backgroundImagePosition: "top center",
      },
      "light",
    );
    expect(presentation.backgroundLayer?.backgroundSize).toBe("100% auto");
    expect(presentation.backgroundLayer?.backgroundPosition).toBe("top center");
    expect(presentation.backgroundLayer?.widgetBackgroundFit).toBe("widthFit");
  });

  it("attaches fit metadata for regular photo backgrounds", () => {
    const presentation = buildWidgetBackgroundPresentation(
      {
        backgroundShow: true,
        backgroundMode: "image",
        backgroundImage: "https://example.com/bg.png",
        backgroundImageFit: "contain",
        backgroundImagePosition: "bottom right",
      },
      "light",
    );
    expect(presentation.backgroundLayer?.widgetBackgroundFit).toBe("contain");
    expect(presentation.backgroundLayer?.widgetBackgroundPosition).toBe("bottom right");
  });
});
