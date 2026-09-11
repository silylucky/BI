import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { CHINA_TERRAIN_BOUNDS } from "@/assets/geo/terrain/manifest";
import { mercatorNormalizedY } from "@/lib/geoMercatorUv";

const DIFFUSE = path.resolve(
  import.meta.dirname,
  "../../../../../assets/geo/terrain/national/diffuse.webp",
);

async function sampleLngLat(lng: number, lat: number) {
  const bounds = CHINA_TERRAIN_BOUNDS;
  const u = (lng - bounds.west) / (bounds.east - bounds.west);
  const yN = mercatorNormalizedY(bounds.north);
  const yS = mercatorNormalizedY(bounds.south);
  const v = (mercatorNormalizedY(lat) - yN) / (yS - yN);
  const { data, info } = await sharp(DIFFUSE).raw().toBuffer({ resolveWithObject: true });
  const x = Math.round(u * (info.width - 1));
  const y = Math.round(v * (info.height - 1));
  const i = (y * info.width + x) * info.channels;
  return { r: data[i], g: data[i + 1], b: data[i + 2] };
}

describe("national terrain geographic audit", () => {
  it("diffuse asset exists", () => {
    expect(fs.existsSync(DIFFUSE)).toBe(true);
  });

  it("east coast (136°E, 30°N) samples ocean-blue pixels", async () => {
    const { r, g, b } = await sampleLngLat(136, 30);
    expect(b).toBeGreaterThan(r);
    expect(b).toBeGreaterThan(g);
    expect(b).toBeGreaterThan(50);
  });

  it("west and east sample distinct colors (full China coverage)", async () => {
    const west = await sampleLngLat(87.6, 43.8);
    const east = await sampleLngLat(121.5, 31.2);
    const dr = Math.abs(west.r - east.r);
    const dg = Math.abs(west.g - east.g);
    const db = Math.abs(west.b - east.b);
    expect(dr + dg + db).toBeGreaterThan(30);
  });
});
