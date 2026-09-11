import { describe, expect, it } from "vitest";
import { applyBackgroundOpacityOnly, withBackgroundAlpha } from "./widgetSurfaceBackground";

describe("withBackgroundAlpha", () => {
  it("converts hex to rgba", () => {
    expect(withBackgroundAlpha("#ffffff", 0.5)).toBe("rgba(255, 255, 255, 0.5)");
  });

  it("uses color-mix for css variables", () => {
    expect(withBackgroundAlpha("var(--dashboard-widget-surface)", 0.96)).toBe(
      "color-mix(in srgb, var(--dashboard-widget-surface) 96%, transparent)",
    );
  });
});

describe("applyBackgroundOpacityOnly", () => {
  it("does not set container opacity for solid backgrounds", () => {
    const { surface, backgroundLayer } = applyBackgroundOpacityOnly({
      background: "#112233",
      opacity: 0.9,
      padding: "8px",
    });
    expect(surface.opacity).toBeUndefined();
    expect(surface.backgroundColor).toBe("rgba(17, 34, 51, 0.9)");
    expect(surface.padding).toBe("8px");
    expect(backgroundLayer).toBeNull();
  });

  it("uses an isolated layer for background images", () => {
    const { surface, backgroundLayer } = applyBackgroundOpacityOnly({
      backgroundImage: "url(https://example.com/bg.png)",
      opacity: 0.8,
    });
    expect(surface.opacity).toBeUndefined();
    expect(surface.backgroundImage).toBeUndefined();
    expect(backgroundLayer?.opacity).toBe(0.8);
    expect(backgroundLayer?.backgroundImage).toContain("example.com/bg.png");
  });

  it("uses frosted glass layer when only backdrop blur is set", () => {
    const { surface, backgroundLayer } = applyBackgroundOpacityOnly({
      background: "#ffffff",
      backdropFilter: "blur(12px)",
    });
    expect(surface.backdropFilter).toBeUndefined();
    expect(surface.backgroundColor).toBeUndefined();
    expect(backgroundLayer?.backdropFilter).toBe("blur(12px)");
    expect(backgroundLayer?.backgroundColor).toBe("rgba(255, 255, 255, 0.82)");
  });

  it("keeps custom opacity when backdrop blur is set", () => {
    const { backgroundLayer } = applyBackgroundOpacityOnly({
      background: "#ffffff",
      backdropFilter: "blur(12px)",
      opacity: 0.5,
    });
    expect(backgroundLayer?.opacity).toBe(0.5);
    expect(backgroundLayer?.backgroundColor).toBe("#ffffff");
    expect(backgroundLayer?.background).toBeUndefined();
  });

  it("preserves background image with backdrop blur", () => {
    const { backgroundLayer } = applyBackgroundOpacityOnly({
      background: "#112233",
      backgroundImage: "url(https://example.com/bg.png)",
      backdropFilter: "blur(8px)",
    });
    expect(backgroundLayer?.backgroundImage).toContain("example.com/bg.png");
    expect(backgroundLayer?.backdropFilter).toBe("blur(8px)");
    expect(backgroundLayer?.backgroundColor).toBe("#112233");
    expect(backgroundLayer?.background).toBeUndefined();
  });
});
