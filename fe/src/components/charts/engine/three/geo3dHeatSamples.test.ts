import { describe, expect, it } from "vitest";
import {
  aggregateHeatBlobSamplesByPosition,
  buildHeatBlobSamples,
  buildHeatBlobSamplesFromRowRegions,
  buildHeatBlobSamplesFromRows,
  resolveHeatCoordColumnIndexes,
} from "@/components/charts/engine/three/geo3dHeatSamples";

describe("geo3dHeatSamples", () => {
  it("detects lng/lat columns case-insensitively", () => {
    expect(resolveHeatCoordColumnIndexes(["city", "Lng", "Lat", "value"])).toEqual({
      lng: 1,
      lat: 2,
    });
    expect(resolveHeatCoordColumnIndexes(["province", "经度", "纬度", "metric"])).toEqual({
      lng: 1,
      lat: 2,
    });
    expect(resolveHeatCoordColumnIndexes(["province", "value"])).toBeNull();
  });

  it("builds one sample per row with coordinates", () => {
    const project = (coord: [number, number]) => [coord[0] * 10, coord[1] * 10] as [number, number];
    const samples = buildHeatBlobSamplesFromRows(
      [
        [104.0, 30.5, 100],
        [104.2, 30.7, 200],
      ],
      ["lng", "lat", "value"],
      "value",
      project,
    );
    expect(samples).toHaveLength(2);
    expect(samples?.[0]).toEqual({ x: 1040, y: 305, value: 100 });
    expect(samples?.[1]).toEqual({ x: 1042, y: 307, value: 200 });
  });

  it("builds row-region samples from national anchor map", () => {
    const anchors = new Map<string, [number, number]>([
      ["成都市", [104.06, 30.65]],
      ["绵阳市", [104.73, 31.47]],
    ]);
    const project = (coord: [number, number]) => [coord[0], coord[1]] as [number, number];
    const { samples } = buildHeatBlobSamplesFromRowRegions(
      [
        ["成都市", 100],
        ["绵阳市", 200],
      ],
      ["city", "value"],
      "city",
      "value",
      anchors,
      project,
    );
    expect(samples).toHaveLength(2);
    expect(samples[0]?.value).toBe(100);
    expect(samples[1]?.value).toBe(200);
  });

  it("aggregates duplicate positions by summing metric values", () => {
    const merged = aggregateHeatBlobSamplesByPosition([
      { x: 1.00004, y: 2.00004, value: 100 },
      { x: 1.000049, y: 2.000049, value: 200 },
      { x: 3, y: 4, value: 50 },
    ]);
    expect(merged).toHaveLength(2);
    expect(merged.find((s) => s.x === 1.00004)?.value).toBe(300);
    expect(merged.find((s) => s.x === 3)?.value).toBe(50);
  });

  it("prefers row coordinates over region centroids", () => {
    const project = (coord: [number, number]) => [coord[0], coord[1]] as [number, number];
    const samples = buildHeatBlobSamples(
      [[103.9, 30.6, 50]],
      ["lng", "lat", "value"],
      "value",
      [
        {
          name: "示例区",
          value: 10,
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [103, 30],
                [104, 30],
                [104, 31],
                [103, 31],
                [103, 30],
              ],
            ],
          },
        },
      ],
      project,
    );
    expect(samples).toHaveLength(1);
    expect(samples[0]?.x).toBe(103.9);
    expect(samples[0]?.y).toBe(30.6);
    expect(samples[0]?.value).toBe(50);
  });
});
