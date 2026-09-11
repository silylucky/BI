import { describe, expect, it } from "vitest";
import {
  buildScreenBorderDeSvg,
  buildScreenBorderDeSvgUrl,
  SCREEN_BORDER_DE_FRAME_IDS,
} from "./screenBorderDeFrames";
import type { ScreenBorderVariant } from "./screenVisualStyle";

const VARIANTS = Object.keys(SCREEN_BORDER_DE_FRAME_IDS) as ScreenBorderVariant[];

describe("screenBorderDeFrames", () => {
  it("maps each screen border variant to a DataEase frame", () => {
    expect(VARIANTS).toHaveLength(9);
    for (const variant of VARIANTS) {
      expect(SCREEN_BORDER_DE_FRAME_IDS[variant]).toMatch(/^frame-\d$/);
    }
  });

  it("builds tinted svg markup and data url", () => {
    const svg = buildScreenBorderDeSvg("border-2", "#22d3ee");
    expect(svg).toContain("<svg");
    expect(svg).toContain("#22d3ee");
    const url = buildScreenBorderDeSvgUrl("border-2", "#22d3ee");
    expect(url.startsWith("data:image/svg+xml,")).toBe(true);
    expect(decodeURIComponent(url)).toContain("#22d3ee");
  });
});
