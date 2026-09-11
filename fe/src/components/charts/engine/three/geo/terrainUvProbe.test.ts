import { describe, expect, it } from "vitest";
import path from "node:path";
import sharp from "sharp";
import chinaProvinces from "@/assets/geo/china-provinces.json";
import yunnanCities from "@/assets/geo/cities/530000.json";
import { nationalUvForLngLat } from "@/components/charts/engine/three/geo/applyGeoCapNationalBridgeUv";
import { uvFromBboxPosition } from "@/components/charts/engine/three/geo/applyGeoCapBboxUv";
import { resolveProvinceTerrainUvBounds } from "@/components/charts/engine/three/geo/chinaTerrainLoader";
import { resolveProvinceTerrainProbeUv } from "@/components/charts/engine/three/geo/provinceTerrainProbe";
import {
  buildNationalTerrainProject,
  buildTerrainAlignedGeoProject,
} from "@/components/charts/engine/three/geo/threeGeoProject";

const TERRAIN_ROOT = path.resolve(import.meta.dirname, "../../../../../assets/geo/terrain");

async function sampleDiffuseRgb(file: string, u: number, v: number): Promise<number> {
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  const px = Math.round(u * (info.width - 1));
  const py = Math.round((1 - v) * (info.height - 1));
  const i = (py * info.width + px) * info.channels;
  return data[i]! + data[i + 1]! + data[i + 2]!;
}

describe("province terrain UV probe", () => {
  it("530000 province centroid UV hits black diffuse (misaligned bake)", async () => {
    const probeUv = resolveProvinceTerrainProbeUv("vs-geo-530000", 1, yunnanCities);
    expect(probeUv).not.toBeNull();
    const diffuse = path.join(TERRAIN_ROOT, "provinces", "530000", "diffuse.webp");
    const sum = await sampleDiffuseRgb(diffuse, probeUv![0], probeUv![1]);
    expect(sum).toBeLessThan(60);
  });

  it("530000 kunming samples national diffuse via bridge UV", async () => {
    const national = buildNationalTerrainProject(chinaProvinces);
    const [u, v] = nationalUvForLngLat(102.7, 25.0, national);
    const diffuse = path.join(TERRAIN_ROOT, "national", "diffuse.webp");
    const sum = await sampleDiffuseRgb(diffuse, u, v);
    expect(sum).toBeGreaterThan(60);
  });

  it("520000 province centroid UV hits valid diffuse", async () => {
    const ctx = buildTerrainAlignedGeoProject(1200, 900, "vs-geo-520000", 1, {
      type: "FeatureCollection",
      features: [],
    });
    const bake = resolveProvinceTerrainUvBounds("vs-geo-520000", 1)!;
    const p = ctx.project([106.7, 26.6]);
    const [u, v] = uvFromBboxPosition(p![0], p![1], bake);
    const diffuse = path.join(TERRAIN_ROOT, "provinces", "520000", "diffuse.webp");
    const sum = await sampleDiffuseRgb(diffuse, u, v);
    expect(sum).toBeGreaterThan(60);
  });
});
