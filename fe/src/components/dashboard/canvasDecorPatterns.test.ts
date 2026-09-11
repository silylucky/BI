import { describe, expect, it } from "vitest";
import {
  decorTileBackgroundLayers,
  decorTileDataUrl,
  decorTileSize,
} from "./canvasDecorPatterns";
import { decorPresetThumbStyle } from "./dashboardStyleConfig";

const DECOR_IDS = ["dots", "grid", "cross", "diagonal"] as const;

describe("canvasDecorPatterns", () => {
  it.each(DECOR_IDS)("canvas tile %s uses visible stroke/fill color on light scheme", (id) => {
    const url = decorTileDataUrl(id, "light", "canvas");
    expect(url).toContain("94a3b8");
    expect(url).toContain("data:image/svg+xml");
  });

  it.each(DECOR_IDS)("thumb tile %s uses higher-contrast color and smaller repeat", (id) => {
    const url = decorTileDataUrl(id, "light", "thumb");
    expect(url).toContain("64748b");
    const size = decorTileSize(id, "thumb");
    expect(size.width).toBeLessThanOrEqual(8);
    expect(size.height).toBeLessThanOrEqual(8);
  });

  it.each(DECOR_IDS)("thumb layers differ from none preview", (id) => {
    const none = decorPresetThumbStyle("none", "light");
    const thumb = decorPresetThumbStyle(id, "light");
    expect(thumb.backgroundImage).toBeTruthy();
    expect(thumb.backgroundImage).not.toBe(none.backgroundImage);
    expect(thumb.backgroundSize).toBe("8px 8px");
  });

  it("background layers wrap data url in quotes", () => {
    const layers = decorTileBackgroundLayers("grid", "light", "canvas");
    expect(layers.backgroundImage).toMatch(/^url\("data:image\/svg\+xml,/);
  });
});
