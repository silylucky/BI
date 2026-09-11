import { describe, expect, it } from "vitest";
import {
  resolveDecorImageLayerPresentation,
  resolveDecorImagePresentation,
  resolveWidgetBackgroundImageLayerPresentation,
  shouldUseDecorImageLayer,
  shouldUseWidgetBackgroundImageLayer,
} from "./widgetDecorBackground";

describe("widgetDecorBackground", () => {
  it("detects any widget background image layer", () => {
    expect(
      shouldUseWidgetBackgroundImageLayer({
        backgroundImage:
          'url("/template-assets/packs/borderless-decor-v1/items/decor-arc-top-orange.svg")',
      }),
    ).toBe(true);
    expect(
      shouldUseWidgetBackgroundImageLayer({
        backgroundImage: 'url("https://example.com/photo.png")',
      }),
    ).toBe(true);
    expect(shouldUseDecorImageLayer({ backgroundImage: 'url("https://example.com/photo.png")' })).toBe(
      true,
    );
  });

  it("maps contain fit to object-fit contain", () => {
    expect(resolveDecorImagePresentation("contain", "center")).toMatchObject({
      objectFit: "contain",
      objectPosition: "center",
    });
  });

  it("maps widthFit to full width with auto height", () => {
    expect(resolveDecorImagePresentation("widthFit", "center")).toMatchObject({
      width: "100%",
      height: "auto",
      maxHeight: "100%",
    });
  });

  it("maps stretch to fill distortion", () => {
    expect(resolveDecorImagePresentation("stretch", "center")).toMatchObject({
      width: "100%",
      height: "100%",
      objectFit: "fill",
    });
  });

  it("prefers explicit widgetBackgroundFit metadata over backgroundSize", () => {
    expect(
      resolveWidgetBackgroundImageLayerPresentation({
        backgroundImage: 'url("https://example.com/bg.png")',
        backgroundSize: "cover",
        widgetBackgroundFit: "widthFit",
        widgetBackgroundPosition: "top center",
      }),
    ).toMatchObject({
      url: "https://example.com/bg.png",
      fit: "widthFit",
      position: "top center",
    });
  });

  it("resolves layer metadata from css background props for decor", () => {
    expect(
      resolveDecorImageLayerPresentation({
        backgroundImage:
          'url("/template-assets/packs/borderless-decor-v1/items/decor-arc-top-orange.svg")',
        backgroundSize: "contain",
        backgroundPosition: "top center",
      }),
    ).toEqual({
      url: "/template-assets/packs/borderless-decor-v1/items/decor-arc-top-orange.svg",
      displayUrl: "/template-assets/packs/borderless-decor-v1/items/decor-arc-top-orange.svg",
      fit: "contain",
      position: "top center",
      opacity: undefined,
      borderRadius: undefined,
    });
  });
});
