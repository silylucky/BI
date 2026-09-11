import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { applyGeoCapBboxUv, uvFromBboxPosition } from "@/components/charts/engine/three/geo/applyGeoCapBboxUv";

describe("uvFromBboxPosition", () => {
  const bbox = { minX: 0, maxX: 100, minY: 0, maxY: 50 };

  it("maps corners to unit square", () => {
    expect(uvFromBboxPosition(0, 0, bbox)).toEqual([0, 0]);
    expect(uvFromBboxPosition(100, 0, bbox)).toEqual([1, 0]);
    expect(uvFromBboxPosition(100, 50, bbox)).toEqual([1, 1]);
    expect(uvFromBboxPosition(0, 50, bbox)).toEqual([0, 1]);
  });
});

describe("applyGeoCapBboxUv", () => {
  it("writes bbox UVs on shape geometry", () => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(10, 0);
    shape.lineTo(10, 10);
    shape.lineTo(0, 10);
    shape.closePath();
    const geometry = new THREE.ShapeGeometry(shape);
    applyGeoCapBboxUv(geometry, { minX: 0, maxX: 10, minY: 0, maxY: 10 });
    const uvs = geometry.attributes.uv as THREE.BufferAttribute;
    let maxU = 0;
    let maxV = 0;
    for (let i = 0; i < uvs.count; i += 1) {
      maxU = Math.max(maxU, uvs.getX(i));
      maxV = Math.max(maxV, uvs.getY(i));
    }
    expect(maxU).toBeGreaterThan(0.9);
    expect(maxV).toBeGreaterThan(0.9);
  });
});
