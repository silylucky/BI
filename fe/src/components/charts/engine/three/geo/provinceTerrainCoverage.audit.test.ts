import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { CHINA_TERRAIN_PROVINCE_ADCODES } from "@/assets/geo/terrain/manifest";
import { nationalUvForLngLat } from "@/components/charts/engine/three/geo/applyGeoCapNationalBridgeUv";
import { buildNationalTerrainProject } from "@/components/charts/engine/three/geo/threeGeoProject";
import chinaProvincesGeo from "@/assets/geo/china-provinces.json";

const TERRAIN_ROOT = path.resolve(import.meta.dirname, "../../../../../assets/geo/terrain");

async function sampleRgb(texPath: string, u: number, v: number): Promise<number> {
  const { data, info } = await sharp(texPath).raw().toBuffer({ resolveWithObject: true });
  const px = Math.max(0, Math.min(info.width - 1, Math.round(u * (info.width - 1))));
  const py = Math.max(0, Math.min(info.height - 1, Math.round(v * (info.height - 1))));
  const i = (py * info.width + px) * info.channels;
  return data[i]! + data[i + 1]! + data[i + 2]!;
}

/** 记录各省代表点在全国贴图桥接 UV 下的可采样性（省级 bake 空洞时靠全国贴图兜底） */
describe("province terrain national bridge coverage", () => {
  const national = buildNationalTerrainProject(chinaProvincesGeo);
  const nationalDiffuse = path.join(TERRAIN_ROOT, "national/diffuse.webp");

  const probes: Array<{ adcode: number; lng: number; lat: number; label: string }> = [
    { adcode: 110000, lng: 116.4, lat: 39.9, label: "北京" },
    { adcode: 540000, lng: 82.56, lat: 33.06, label: "阿里" },
    { adcode: 510000, lng: 104.06, lat: 30.67, label: "成都" },
    { adcode: 650000, lng: 87.62, lat: 43.82, label: "乌鲁木齐" },
    { adcode: 440000, lng: 113.3, lat: 23.1, label: "广州" },
    { adcode: 520000, lng: 106.7, lat: 26.6, label: "贵阳" },
  ];

  it("national diffuse exists", () => {
    expect(fs.existsSync(nationalDiffuse)).toBe(true);
  });

  it.each(probes)(
    "$label ($adcode) samples non-black via national bridge UV",
    async ({ lng, lat }) => {
      const [u, v] = nationalUvForLngLat(lng, lat, national);
      const sum = await sampleRgb(nationalDiffuse, u, v);
      expect(sum).toBeGreaterThan(60);
    },
  );

  it("all 34 provinces have terrain pack assets on disk", () => {
    expect(CHINA_TERRAIN_PROVINCE_ADCODES.length).toBe(34);
    for (const adcode of CHINA_TERRAIN_PROVINCE_ADCODES) {
      const dir = path.join(TERRAIN_ROOT, "provinces", String(adcode));
      expect(fs.existsSync(path.join(dir, "diffuse.webp"))).toBe(true);
      expect(fs.existsSync(path.join(dir, "meta.json"))).toBe(true);
    }
  });
});
