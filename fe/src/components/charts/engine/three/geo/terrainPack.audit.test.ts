import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  CHINA_TERRAIN_BOUNDS,
  CHINA_TERRAIN_PROVINCE_ADCODES,
} from "@/assets/geo/terrain/manifest";

const TERRAIN_ROOT = path.resolve(
  import.meta.dirname,
  "../../../../../assets/geo/terrain",
);

function packDir(level: "national" | "province", adcode?: number) {
  if (level === "national") return path.join(TERRAIN_ROOT, "national");
  return path.join(TERRAIN_ROOT, "provinces", String(adcode));
}

function assertPack(level: "national" | "province", adcode?: number) {
  const dir = packDir(level, adcode);
  const metaPath = path.join(dir, "meta.json");
  expect(fs.existsSync(metaPath), `${metaPath} missing`).toBe(true);
  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8")) as {
    bounds: number[];
    width?: number;
    height?: number;
    size?: number;
    source?: string;
    uvMode?: string;
    refViewport?: number[];
    masked?: boolean;
  };
  expect(meta.bounds).toHaveLength(4);
  const w = meta.width ?? meta.size ?? 0;
  const h = meta.height ?? meta.size ?? 0;
  expect(w).toBeGreaterThan(0);
  expect(h).toBeGreaterThan(0);
  expect(meta.source).toBe("satellite");
  expect(meta.uvMode).toBe("projBounds");
  const refVp = meta.refViewport;
  if (Array.isArray(refVp)) {
    expect(refVp).toEqual([800, 600]);
  } else {
    expect(refVp).toEqual({ width: 800, height: 600 });
  }
  expect(meta.masked).toBe(true);

  const diffuse = path.join(dir, "diffuse.webp");
  expect(fs.existsSync(diffuse), diffuse).toBe(true);
  expect(fs.statSync(diffuse).size).toBeGreaterThan(1024);
  if (level === "province") {
    expect(Math.max(w, h)).toBeGreaterThanOrEqual(4096);
    expect(Math.min(w, h)).toBeGreaterThanOrEqual(2000);
  }
}

describe("terrain satellite pack audit", () => {
  it("national pack has satellite meta and high-res diffuse webp", () => {
    assertPack("national");
    const meta = JSON.parse(
      fs.readFileSync(path.join(packDir("national"), "meta.json"), "utf8"),
    ) as { bounds: number[]; width: number; height: number };
    expect(meta.bounds[0]).toBe(CHINA_TERRAIN_BOUNDS.west);
    expect(meta.bounds[2]).toBe(CHINA_TERRAIN_BOUNDS.east);
    expect(meta.width).toBeGreaterThanOrEqual(3500);
    expect(meta.height).toBeGreaterThanOrEqual(3500);
    expect(meta.width).toBeGreaterThan(meta.height * 0.9);
  });

  it("all 34 province packs are complete at 4096px", () => {
    expect(CHINA_TERRAIN_PROVINCE_ADCODES.length).toBe(34);
    for (const adcode of CHINA_TERRAIN_PROVINCE_ADCODES) {
      assertPack("province", adcode);
    }
  });
});
