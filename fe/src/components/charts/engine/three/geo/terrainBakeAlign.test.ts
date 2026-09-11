import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import guizhouCitiesGeo from "@/assets/geo/cities/520000.json";
import chinaProvincesGeo from "@/assets/geo/china-provinces.json";
import { isDecorativeGeoFeature } from "@/components/charts/engine/geo/geoProjection";
import { uvFromBboxPosition } from "@/components/charts/engine/three/geo/applyGeoCapBboxUv";
import {
  buildProvinceOutlineFitCollection,
  buildTerrainAlignedGeoProject,
  buildThreeGeoProject,
  resolveTerrainProjectionFitCollection,
  TERRAIN_REF_VIEWPORT,
} from "@/components/charts/engine/three/geo/threeGeoProject";

const BAKE_META = path.resolve(
  import.meta.dirname,
  "../../../../../assets/geo/terrain/provinces/520000/_source/bake-meta.json",
);

describe("province terrain bake alignment", () => {
  const bakeMeta = JSON.parse(fs.readFileSync(BAKE_META, "utf8")) as {
    refViewport: [number, number];
    projBounds: { minX: number; maxX: number; minY: number; maxY: number };
  };

  it("runtime projBounds match bake-meta at ref viewport", () => {
    const ctx = buildTerrainAlignedGeoProject(
      1200,
      900,
      "vs-geo-520000",
      1,
      guizhouCitiesGeo,
    );
    expect(ctx.projBounds.minX).toBeCloseTo(bakeMeta.projBounds.minX, 2);
    expect(ctx.projBounds.maxX).toBeCloseTo(bakeMeta.projBounds.maxX, 2);
    expect(ctx.projBounds.minY).toBeCloseTo(bakeMeta.projBounds.minY, 2);
    expect(ctx.projBounds.maxY).toBeCloseTo(bakeMeta.projBounds.maxY, 2);
  });

  it("Guiyang centroid maps to interior UV", () => {
    const ctx = buildTerrainAlignedGeoProject(640, 480, "vs-geo-520000", 1, guizhouCitiesGeo);
    const p = ctx.project([106.7, 26.6]);
    expect(p).not.toBeNull();
    const [u, v] = uvFromBboxPosition(p![0], p![1], ctx.projBounds);
    expect(u).toBeGreaterThan(0.1);
    expect(u).toBeLessThan(0.9);
    expect(v).toBeGreaterThan(0.1);
    expect(v).toBeLessThan(0.9);
  });

  it("raw province outline matches bake projBounds", () => {
    const raw = chinaProvincesGeo.features.find(
      (f) => Number(f.properties?.adcode) === 520000 && !isDecorativeGeoFeature(f.properties),
    );
    expect(raw?.geometry).toBeTruthy();
    const rawFit = {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          properties: { name: "贵州省" },
          geometry: raw!.geometry!,
        },
      ],
    };
    const ctx = buildThreeGeoProject(
      TERRAIN_REF_VIEWPORT.width,
      TERRAIN_REF_VIEWPORT.height,
      rawFit.features,
      rawFit,
    );
    expect(ctx.projBounds.minX).toBeCloseTo(bakeMeta.projBounds.minX, 2);
    expect(ctx.projBounds.maxY).toBeCloseTo(bakeMeta.projBounds.maxY, 2);
  });

  it("resolveTerrainProjectionFitCollection uses province outline", () => {
    const aligned = resolveTerrainProjectionFitCollection("vs-geo-520000", 1, guizhouCitiesGeo);
    const province = buildProvinceOutlineFitCollection(520000);
    expect(aligned.features).toHaveLength(1);
    expect(province?.features[0]?.properties?.name).toBe("贵州省");
  });
});
