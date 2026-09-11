import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  buildGeo3dPointPillar,
  resolveVerticalBillboardYaw,
} from "@/components/charts/engine/three/geo3dPointPillar";
import { resolvePointEffectsStyle } from "@/components/charts/engine/three/geo3dPointEffectsStyle";

describe("geo3dPointPillar", () => {
  const style = resolvePointEffectsStyle({ stylePreset: "tech" }, "tech", true, true);

  it("resolveVerticalBillboardYaw differs by ~90deg for orthogonal camera positions", () => {
    const worldPos = new THREE.Vector3(0, 0, 0);
    const camX = new THREE.PerspectiveCamera();
    camX.position.set(10, 0, 5);
    const camY = new THREE.PerspectiveCamera();
    camY.position.set(0, 10, 5);

    const yawX = resolveVerticalBillboardYaw(worldPos, camX);
    const yawY = resolveVerticalBillboardYaw(worldPos, camY);
    expect(Math.abs(yawY - yawX - Math.PI / 2)).toBeLessThan(0.01);
  });

  it("buildGeo3dPointPillar exposes beamMesh and disposes cleanly", () => {
    const pillar = buildGeo3dPointPillar(2, style, 0.5);
    expect(pillar.beamMesh).toBeDefined();
    expect(pillar.ringMesh).toBeDefined();
    expect(pillar.barHeight).toBe(2);
    expect(() => pillar.dispose()).not.toThrow();
  });

  it("ring size follows pointPillarBaseRingScale", () => {
    const small = buildGeo3dPointPillar(
      2,
      { ...style, pointPillarBaseRingScale: 0.5 },
      1,
    );
    const large = buildGeo3dPointPillar(
      2,
      { ...style, pointPillarBaseRingScale: 2 },
      1,
    );
    const smallGeom = small.ringMesh.geometry as THREE.PlaneGeometry;
    const largeGeom = large.ringMesh.geometry as THREE.PlaneGeometry;
    expect(largeGeom.parameters.width).toBeGreaterThan(smallGeom.parameters.width);
    small.dispose();
    large.dispose();
  });
});
