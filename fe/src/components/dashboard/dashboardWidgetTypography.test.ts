import { describe, expect, it } from "vitest";
import {
  resolveWidgetTitleChromeMetrics,
  shapeInnerShellChromeStyle,
  shapeTitleChromeStyle,
  shapeTitlePresentationStyle,
  shapeTitleStackStyle,
  resolveShapeTitleCanvasScale,
  pixelViewTitleHeightPx,
} from "./dashboardWidgetTypography";

describe("resolveShapeTitleCanvasScale", () => {
  it("skips compensation when outer viewport already scaled", () => {
    expect(resolveShapeTitleCanvasScale(0.25, true)).toBe(1);
  });

  it("skips compensation in view mode for WYSIWYG preview", () => {
    expect(resolveShapeTitleCanvasScale(0.5, false, "view")).toBe(1);
    expect(resolveShapeTitleCanvasScale(0.5, false)).toBe(1);
  });

  it("uses canvas scale in edit mode when viewport is not locked", () => {
    expect(resolveShapeTitleCanvasScale(0.5, false, "edit")).toBe(0.5);
  });

  it("skips compensation in edit mode when design viewport is locked", () => {
    expect(resolveShapeTitleCanvasScale(0.5, true, "edit")).toBe(1);
  });
});

describe("shapeTitlePresentationStyle", () => {
  it("preserves configured font size with canvas scale compensation", () => {
    expect(
      shapeTitlePresentationStyle({ fontSize: 21, color: "#111" }, 0.5),
    ).toEqual({
      color: "#111",
      fontSize: "42px",
      lineHeight: 1.25,
    });
  });

  it("omits font size when not configured", () => {
    expect(shapeTitlePresentationStyle({ color: "#111" }, 1)).toEqual({ color: "#111" });
  });
});

describe("resolveWidgetTitleChromeMetrics", () => {
  it("uses default metrics when title font is not configured", () => {
    expect(resolveWidgetTitleChromeMetrics({})).toEqual({
      fontSizePx: 16,
      lineHeightPx: 22,
      topPadPx: 4,
      gapPx: 2,
      blockHeightPx: 28,
    });
  });

  it("only scales top padding with configured font size", () => {
    expect(resolveWidgetTitleChromeMetrics({ fontSize: 32 })).toMatchObject({
      fontSizePx: 32,
      topPadPx: 8,
      gapPx: 2,
      blockHeightPx: 54,
    });
  });
});

describe("shapeTitleChromeStyle", () => {
  it("sets inline min-height from title line height", () => {
    expect(shapeTitleChromeStyle({ fontSize: 24 }, 0.5)).toEqual({
      minHeight: "calc(33px / var(--pixel-canvas-chrome-scale, 0.5))",
      paddingTop: 0,
      paddingBottom: 0,
      margin: 0,
    });
  });
});

describe("shapeTitleStackStyle", () => {
  it("uses fixed flex gap regardless of font size", () => {
    expect(shapeTitleStackStyle({ fontSize: 32 }, 1)).toEqual({
      gap: "calc(2px / var(--pixel-canvas-chrome-scale, 1))",
    });
  });
});

describe("shapeInnerShellChromeStyle", () => {
  it("only sets top padding from title font size", () => {
    expect(shapeInnerShellChromeStyle({ fontSize: 32 }, 1)).toEqual({
      paddingTop: "calc(8px / var(--pixel-canvas-chrome-scale, 1))",
    });
  });
});

describe("pixelViewTitleHeightPx", () => {
  it("matches block height in design coordinates", () => {
    expect(pixelViewTitleHeightPx(1, { fontSize: 24 })).toBe(41);
    expect(pixelViewTitleHeightPx(0.5, { fontSize: 24 })).toBe(82);
  });
});
