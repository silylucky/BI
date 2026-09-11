import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildPmtilesVectorSourceUrl,
  resolveGisPmtilesArchiveUrl,
  withDevPmtilesArchiveUrl,
} from "@/components/charts/engine/maplibre/gisPmtilesUrl";

describe("gisPmtilesUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rewrites dev archive url through vite proxy on same origin", () => {
    vi.stubEnv("DEV", true);
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { origin: "http://127.0.0.1:5173" },
    });
    expect(
      resolveGisPmtilesArchiveUrl("http://localhost:8080/planet-z15-20260817.pmtiles"),
    ).toBe("http://127.0.0.1:5173/dev-pmtiles/planet-z15-20260817.pmtiles");
  });

  it("keeps production url unchanged", () => {
    vi.stubEnv("DEV", false);
    const raw = "https://tiles.example.com/planet-z15.pmtiles";
    expect(resolveGisPmtilesArchiveUrl(raw)).toBe(raw);
  });

  it("does not double-proxy dev-pmtiles urls", () => {
    vi.stubEnv("DEV", true);
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { origin: "http://127.0.0.1:5173" },
    });
    const proxied = "http://127.0.0.1:5173/dev-pmtiles/planet-z15-20260817.pmtiles";
    expect(resolveGisPmtilesArchiveUrl(proxied)).toBe(proxied);
  });

  it("builds pmtiles protocol source url", () => {
    expect(buildPmtilesVectorSourceUrl("http://127.0.0.1:5173/dev-pmtiles/a.pmtiles")).toBe(
      "pmtiles://http://127.0.0.1:5173/dev-pmtiles/a.pmtiles",
    );
  });

  it("wraps resolve payload", () => {
    vi.stubEnv("DEV", true);
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { origin: "http://127.0.0.1:5173" },
    });
    const next = withDevPmtilesArchiveUrl({
      id: "planet-z15",
      name: "Planet Z15",
      pmtilesUrl: "http://localhost:8080/planet-z15-20260817.pmtiles",
      glyphsUrl: "http://localhost:8080/basemaps-assets/fonts/{fontstack}/{range}.pbf",
      spriteUrl: "http://localhost:8080/basemaps-assets/sprites/v4/light",
    });
    expect(next.pmtilesUrl).toContain("/dev-pmtiles/planet-z15-20260817.pmtiles");
    expect(next.glyphsUrl).toBe(
      "http://127.0.0.1:5173/dev-pmtiles/basemaps-assets/fonts/{fontstack}/{range}.pbf",
    );
    expect(next.spriteUrl).toBe(
      "http://127.0.0.1:5173/dev-pmtiles/basemaps-assets/sprites/v4/light",
    );
    expect(next.glyphsUrl).not.toContain("jsdelivr");
    expect(next.glyphsUrl).not.toContain("github.io");
  });

  it("rewrites leftover public glyph urls onto the local tile proxy", () => {
    vi.stubEnv("DEV", true);
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { origin: "http://127.0.0.1:5173" },
    });
    expect(
      resolveGisPmtilesArchiveUrl(
        "https://fastly.jsdelivr.net/gh/protomaps/basemaps-assets@main/fonts/{fontstack}/{range}.pbf",
      ),
    ).toBe("http://127.0.0.1:5173/dev-pmtiles/basemaps-assets/fonts/{fontstack}/{range}.pbf");
  });
});
