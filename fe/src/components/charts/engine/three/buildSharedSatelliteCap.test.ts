import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildSharedSatelliteCap } from "@/components/charts/engine/three/buildSharedSatelliteCap";
import { buildThreeGeoProject } from "@/components/charts/engine/three/geo/threeGeoProject";

describe("buildSharedSatelliteCap", () => {
  it("merges multiple province shapes into one cap mesh", () => {
    const geoProject = buildThreeGeoProject(800, 600, [], {
      type: "FeatureCollection",
      features: [],
    });
    const a = new THREE.Shape();
    a.moveTo(0, 0);
    a.lineTo(10, 0);
    a.lineTo(10, 10);
    a.closePath();
    const b = new THREE.Shape();
    b.moveTo(12, 0);
    b.lineTo(22, 0);
    b.lineTo(22, 10);
    b.closePath();

    const tex = new THREE.Texture();
    const mesh = buildSharedSatelliteCap([a, b], 2, geoProject.projBounds, tex);

    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.geometry.attributes.position.count).toBeGreaterThanOrEqual(6);
    expect((mesh.material as THREE.MeshBasicMaterial).map).toBe(tex);
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  });
});
