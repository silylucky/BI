import { describe, expect, it } from "vitest";
import {
  buildScreenTitleBarImagePath,
  inferScreenTitleBarPalette,
  resolveLegacyTitleBarWidgetStyle,
  resolveScreenTitleBarImageUrl,
} from "./screenTitleBarAssets";
import { SCREEN_TITLE_BAR_MARKER } from "./screenVisualAssets";

describe("screenTitleBarAssets", () => {
  it("builds pack image path from variant and palette", () => {
    expect(buildScreenTitleBarImagePath("de-trapezoid-wing", "cobalt")).toBe(
      "/template-assets/packs/gov-enterprise-v1/screen-headers/screen-header-de-trapezoid-wing-cobalt.svg",
    );
  });

  it("prefers explicit backgroundImage", () => {
    expect(
      resolveScreenTitleBarImageUrl({
        backgroundImage: "/custom/title.png",
        variant: "de-trapezoid-wing",
        palette: "cyan",
      }),
    ).toBe("/custom/title.png");
  });

  it("infers palette from accent when backgroundImage omitted", () => {
    expect(inferScreenTitleBarPalette("#22d3ee")).toBe("cyan");
    expect(
      resolveScreenTitleBarImageUrl({
        variant: "de-circuit-sym",
        accentColor: "#22d3ee",
      }),
    ).toContain("screen-header-de-circuit-sym-cyan.svg");
  });

  it("merges legacy title bar marker into widgetStyle background", () => {
    const style = resolveLegacyTitleBarWidgetStyle({
      type: "text",
      textConfig: {
        content: SCREEN_TITLE_BAR_MARKER,
        variant: "plain",
        screenStyle: {
          titleBar: { variant: "de-trapezoid-wing", palette: "cyan" },
        },
      },
    });
    expect(style?.backgroundMode).toBe("image");
    expect(style?.backgroundImage).toContain("screen-header-de-trapezoid-wing-cyan.svg");
  });
});
