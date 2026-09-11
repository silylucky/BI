import { describe, expect, it, vi } from "vitest";
import {
  expandGlyphsProbeUrl,
  probeTileServiceBasemapAssets,
  spriteJsonUrl,
} from "./tileServiceAssetsHealth";

describe("tileServiceAssetsHealth", () => {
  it("expands glyph template to a concrete pbf URL", () => {
    expect(
      expandGlyphsProbeUrl("http://127.0.0.1:8080/basemaps-assets/fonts/{fontstack}/{range}.pbf"),
    ).toBe("http://127.0.0.1:8080/basemaps-assets/fonts/Noto%20Sans%20Regular/0-255.pbf");
  });

  it("appends .json to sprite prefix", () => {
    expect(spriteJsonUrl("http://127.0.0.1:8080/basemaps-assets/sprites/v4/light")).toBe(
      "http://127.0.0.1:8080/basemaps-assets/sprites/v4/light.json",
    );
  });

  it("fails when glyph or sprite probe is not ok", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith(".pbf")) return new Response(null, { status: 200 });
      return new Response(null, { status: 404 });
    });
    const result = await probeTileServiceBasemapAssets(
      {
        glyphsUrl: "http://tiles/fonts/{fontstack}/{range}.pbf",
        spriteUrl: "http://tiles/sprites/v4/light",
      },
      fetchImpl,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("标注资源");
    }
  });

  it("succeeds when glyph pbf and sprite json both return 200", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    const result = await probeTileServiceBasemapAssets(
      {
        glyphsUrl: "http://tiles/fonts/{fontstack}/{range}.pbf",
        spriteUrl: "http://tiles/sprites/v4/light",
      },
      fetchImpl,
    );
    expect(result).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
