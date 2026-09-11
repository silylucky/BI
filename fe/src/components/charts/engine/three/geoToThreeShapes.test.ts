import * as d3 from "d3";
import { describe, expect, it } from "vitest";
import { fitChinaGeoProjection } from "@/components/charts/engine/geo/geoProjection";
import { joinOfflineMapFeatures } from "@/components/charts/engine/geo/OfflineGeoPort";
import { VS_REGIONS_MAP_ID } from "@/components/charts/engine/geo/geoConstants";
import { geometryToShapes } from "@/components/charts/engine/three/geoToThreeShapes";

describe("geometryToShapes national map", () => {
  it("builds shapes for all 34 provinces", () => {
    const width = 640;
    const height = 480;
    const margin = { top: 8, right: 12, bottom: 24, left: 12 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;
    const features = joinOfflineMapFeatures([], ["p", "v"], "p", "v", VS_REGIONS_MAP_ID).filter(
      (f) => f.geometry,
    );
    const collection = {
      type: "FeatureCollection" as const,
      features: features.map((f) => ({
        type: "Feature" as const,
        properties: { name: f.name },
        geometry: f.geometry!,
      })),
    };
    const projection = fitChinaGeoProjection(d3.geoMercator(), innerW, innerH, collection);
    const project = (coord: [number, number]) => {
      const p = projection(coord);
      return p ? ([p[0] - width / 2, -(p[1] - height / 2)] as [number, number]) : null;
    };

    let withShapes = 0;
    let totalShapes = 0;
    const missing: string[] = [];
    for (const f of features) {
      const shapes = geometryToShapes(f.geometry!, project);
      if (shapes.length > 0) withShapes += 1;
      else missing.push(f.name);
      totalShapes += shapes.length;
    }

    expect(features).toHaveLength(34);
    expect(withShapes).toBe(34);
    expect(totalShapes).toBeGreaterThan(34);
    expect(missing).toEqual([]);
  });
});
