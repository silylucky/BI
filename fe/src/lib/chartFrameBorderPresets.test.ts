import { describe, expect, it } from "vitest";
import {
  buildChartFrameBorderSvgUrl,
  CHART_FRAME_BORDER_PRESETS,
  resolveChartFrameOverlayLayer,
} from "./chartFrameBorderPresets";
import { widgetStyleToContentCss } from "./chartDeStyle";

describe("chartFrameBorderPresets", () => {
  it("exposes nine frame presets", () => {
    expect(CHART_FRAME_BORDER_PRESETS).toHaveLength(9);
    expect(CHART_FRAME_BORDER_PRESETS[0]?.label).toBe("边框1");
  });

  it("builds tinted svg data urls", () => {
    const url = buildChartFrameBorderSvgUrl("frame-2", "#ff0000");
    expect(url.startsWith("data:image/svg+xml,")).toBe(true);
    const decoded = decodeURIComponent(url);
    expect(decoded).toContain('fill="#ff0000"');
    expect(decoded).toContain("<svg");
    expect(decoded).toContain("<path fill=\"#ff0000\"");
  });

  it("resolves stretch overlay styles", () => {
    const style = resolveChartFrameOverlayLayer("frame-1", "#3370ff");
    expect(style.backgroundImage).toContain("data:image/svg+xml");
    expect(style.backgroundSize).toBe("100% 100%");
    expect(style.transform).toContain("translateZ");
  });
});

describe("widgetStyleToContentCss frame mode", () => {
  it("applies decorative frame overlay when backgroundMode is frame", () => {
    const { surface, frameLayer } = widgetStyleToContentCss({
      backgroundShow: true,
      backgroundMode: "frame",
      framePresetId: "frame-3",
      frameColor: "#3370ff",
    });
    expect(surface.borderImageSource).toBeUndefined();
    expect(frameLayer?.backgroundImage).toContain("data:image/svg+xml");
    expect(surface.backgroundImage).toBeUndefined();
  });

  it("applies background image on overlay layer", () => {
    const { surface, backgroundLayer } = widgetStyleToContentCss({
      backgroundShow: true,
      backgroundMode: "image",
      backgroundImage: "https://example.com/bg.png",
    });
    expect(surface.backgroundImage).toBeUndefined();
    expect(backgroundLayer?.backgroundImage).toContain("example.com/bg.png");
  });

  it("skips visual background when backgroundShow is false", () => {
    const { surface, frameLayer } = widgetStyleToContentCss({
      backgroundShow: false,
      backgroundMode: "frame",
      framePresetId: "frame-1",
      padding: 12,
    });
    expect(frameLayer).toBeNull();
    expect(surface.padding).toBe("12px");
  });
});
