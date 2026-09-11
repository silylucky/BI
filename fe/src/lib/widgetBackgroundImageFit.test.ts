import { describe, expect, it } from "vitest";
import {
  backgroundImageFitSupportsPosition,
  inferDefaultBackgroundImageFitForUrl,
  normalizeBackgroundImageFitForUi,
  resolveWidgetBackgroundImageLayerStyle,
} from "./widgetBackgroundImageFit";

describe("widgetBackgroundImageFit", () => {
  it("defaults to stretch for legacy configs", () => {
    expect(resolveWidgetBackgroundImageLayerStyle({})).toEqual({
      backgroundSize: "100% 100%",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    });
  });

  it("maps widthFit to 100% auto and center default", () => {
    expect(
      resolveWidgetBackgroundImageLayerStyle({ backgroundImageFit: "widthFit" }),
    ).toEqual({
      backgroundSize: "100% auto",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    });
  });

  it("keeps decor contain as contain layer style", () => {
    expect(
      resolveWidgetBackgroundImageLayerStyle({
        backgroundImage:
          "/template-assets/packs/borderless-decor-v1/items/decor-arc-top-orange.svg",
        backgroundImageFit: "contain",
        backgroundImagePosition: "top center",
      }),
    ).toEqual({
      backgroundSize: "contain",
      backgroundPosition: "top center",
      backgroundRepeat: "no-repeat",
    });
  });

  it("respects explicit position override", () => {
    expect(
      resolveWidgetBackgroundImageLayerStyle({
        backgroundImageFit: "contain",
        backgroundImagePosition: "bottom right",
      }),
    ).toMatchObject({
      backgroundSize: "contain",
      backgroundPosition: "bottom right",
    });
  });

  it("infers widthFit center for borderless decor and screen headers", () => {
    expect(
      inferDefaultBackgroundImageFitForUrl(
        "/template-assets/packs/borderless-decor-v1/items/decor-bow-deep-cyan.svg",
      ),
    ).toEqual({
      backgroundImageFit: "widthFit",
      backgroundImagePosition: "center",
    });
    expect(
      inferDefaultBackgroundImageFitForUrl(
        "/template-assets/packs/gov-enterprise-v1/screen-headers/screen-header-de-trapezoid-wing-cyan.svg",
      ),
    ).toEqual({
      backgroundImageFit: "widthFit",
      backgroundImagePosition: "center",
    });
    expect(inferDefaultBackgroundImageFitForUrl("https://example.com/bg.png")).toBeNull();
  });

  it("stretch does not support position UI", () => {
    expect(backgroundImageFitSupportsPosition("stretch")).toBe(false);
    expect(backgroundImageFitSupportsPosition("widthFit")).toBe(true);
  });

  it("maps legacy fit modes to contain for simplified UI", () => {
    expect(normalizeBackgroundImageFitForUi("widthFit")).toBe("contain");
    expect(normalizeBackgroundImageFitForUi("heightFit")).toBe("contain");
    expect(normalizeBackgroundImageFitForUi("original")).toBe("contain");
    expect(normalizeBackgroundImageFitForUi("cover")).toBe("cover");
  });
});
