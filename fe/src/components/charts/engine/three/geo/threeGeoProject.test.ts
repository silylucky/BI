import { describe, expect, it } from "vitest";
import chinaProvincesGeo from "@/assets/geo/china-provinces.json";
import guizhouCitiesGeo from "@/assets/geo/cities/520000.json";
import {
  buildMapFitCollection,
  buildProvinceOutlineFitCollection,
  buildThreeGeoProject,
  resolveTerrainProjectionFitCollection,
} from "@/components/charts/engine/three/geo/threeGeoProject";

describe("buildThreeGeoProject", () => {
  it("anchors national map on projected bbox center", () => {
    const fitCollection = buildMapFitCollection(chinaProvincesGeo);
    const ctx = buildThreeGeoProject(800, 600, fitCollection.features, fitCollection);
    const midX = (ctx.projBounds.minX + ctx.projBounds.maxX) / 2;
    const midY = (ctx.projBounds.minY + ctx.projBounds.maxY) / 2;
    expect(Math.abs(midX)).toBeLessThan(1);
    expect(Math.abs(midY)).toBeLessThan(1);
  });

  it("province drill uses province outline for terrain projection (matches bake)", () => {
    const cityFit = buildMapFitCollection(guizhouCitiesGeo);
    const provinceFit = buildProvinceOutlineFitCollection(520000);
    expect(provinceFit).not.toBeNull();

    const cityProject = buildThreeGeoProject(800, 600, cityFit.features, cityFit);
    const provinceProject = buildThreeGeoProject(
      800,
      600,
      provinceFit!.features,
      provinceFit!,
    );
    const aligned = resolveTerrainProjectionFitCollection("vs-geo-520000", 1, guizhouCitiesGeo);
    const alignedProject = buildThreeGeoProject(800, 600, aligned.features, aligned);

    expect(alignedProject.projBounds.minX).toBeCloseTo(provinceProject.projBounds.minX, 1);
    expect(alignedProject.projBounds.maxX).toBeCloseTo(provinceProject.projBounds.maxX, 1);
    expect(alignedProject.projBounds.minY).toBeCloseTo(provinceProject.projBounds.minY, 1);
    expect(alignedProject.projBounds.maxY).toBeCloseTo(provinceProject.projBounds.maxY, 1);

    const spanCityX = cityProject.projBounds.maxX - cityProject.projBounds.minX;
    const spanProvX = provinceProject.projBounds.maxX - provinceProject.projBounds.minX;
    expect(Math.abs(spanCityX - spanProvX)).toBeLessThan(0.1);
  });

  it("computes proj bounds from joined features", () => {
    const geometry = {
      type: "Polygon" as const,
      coordinates: [
        [
          [105, 30],
          [106, 30],
          [106, 31],
          [105, 31],
          [105, 30],
        ],
      ],
    };
    const fitCollection = {
      type: "FeatureCollection" as const,
      features: [{ type: "Feature" as const, properties: {}, geometry }],
    };
    const ctx = buildThreeGeoProject(800, 600, fitCollection.features, fitCollection);
    expect(ctx.projBounds.maxX - ctx.projBounds.minX).toBeGreaterThan(0);
    expect(ctx.projBounds.maxY - ctx.projBounds.minY).toBeGreaterThan(0);
  });
});
