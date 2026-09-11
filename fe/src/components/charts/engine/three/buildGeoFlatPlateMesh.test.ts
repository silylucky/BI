import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  buildGeoFlatPlateMesh,
  GEO_BORDER_ABOVE_CAP_Z,
  resolveGeoCapTopZ,
  resolveGeoPlateDepth,
} from "@/components/charts/engine/three/buildGeoFlatPlateMesh";
import { buildThreeGeoProject } from "@/components/charts/engine/three/geo/threeGeoProject";

describe("buildGeoFlatPlateMesh", () => {
  it("returns group with cap + extrude body when terrain opts provided", () => {
    const geoProject = buildThreeGeoProject(800, 600, [], {
      type: "FeatureCollection",
      features: [],
    });
    const shape = new THREE.Shape();
    shape.moveTo(-10, -10);
    shape.lineTo(10, -10);
    shape.lineTo(10, 10);
    shape.lineTo(-10, 10);
    shape.closePath();

    const terrainMap = new THREE.Texture();
    const depth = 2;
    const built = buildGeoFlatPlateMesh(shape, depth, 0x0284c7, 0x7dd3fc, true, {
      terrainColorMap: terrainMap,
      projBounds: geoProject.projBounds,
      dataTint: 0x0284c7,
      valueT: 0.5,
    });

    expect(built.mesh).toBeInstanceOf(THREE.Group);
    expect(built.mesh.children.length).toBe(3);
    expect(built.capMaterial).toBeInstanceOf(THREE.MeshBasicMaterial);
    expect(built.capMaterial.map).toBe(terrainMap);

    const capMesh = built.mesh.children.find(
      (c) => c instanceof THREE.Mesh && c.material === built.capMaterial,
    ) as THREE.Mesh;
    expect(capMesh).toBeTruthy();
    expect(capMesh.position.z).toBeCloseTo(resolveGeoCapTopZ(depth, true));
    expect(capMesh.geometry.attributes.uv).toBeTruthy();
  });

  it("satellite cap sits flush on extrude top", () => {
    expect(resolveGeoCapTopZ(2, true)).toBeCloseTo(2.02);
    expect(resolveGeoCapTopZ(2, false)).toBeGreaterThan(2.02);
  });

  it("plate depth scales with proj bounds span", () => {
    const national = { minX: -300, maxX: 300, minY: -250, maxY: 250 };
    const province = { minX: -4.5, maxX: 4.5, minY: -3.9, maxY: 3.9 };
    const nationalDepth = resolveGeoPlateDepth(national, 1, 0);
    const provinceDepth = resolveGeoPlateDepth(province, 1, 1);
    expect(nationalDepth / 600).toBeCloseTo(provinceDepth / 9, 1);
    expect(provinceDepth).toBeLessThan(0.5);
  });

  it("uses top outline only (no vertical extrude edges)", () => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(2, 0);
    shape.lineTo(2, 1);
    shape.lineTo(0, 1);
    shape.closePath();
    const built = buildGeoFlatPlateMesh(shape, 1, 0x0284c7, 0x7dd3fc, true);
    const hidden = buildGeoFlatPlateMesh(shape, 1, 0x0284c7, 0x7dd3fc, true, {
      showBorderLines: false,
    });
    const border = built.borderLines;
    const pos = border.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      expect(pos.getZ(i)).toBeCloseTo(resolveGeoCapTopZ(1, false) + GEO_BORDER_ABOVE_CAP_Z);
    }
    expect(hidden.borderLines.visible).toBe(false);
  });

  it("applies shell opacity to extrude body material", () => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(2, 0);
    shape.lineTo(2, 1);
    shape.lineTo(0, 1);
    shape.closePath();
    const built = buildGeoFlatPlateMesh(shape, 1, 0x0284c7, 0x7dd3fc, true, {
      shellOpacity: 0.4,
    });
    const bodyMesh = built.mesh.children.find(
      (c) => c instanceof THREE.Mesh && c.material !== built.capMaterial,
    ) as THREE.Mesh;
    const materials = Array.isArray(bodyMesh.material) ? bodyMesh.material : [bodyMesh.material];
    for (const mat of materials) {
      expect(mat).toBeInstanceOf(THREE.MeshStandardMaterial);
      expect((mat as THREE.MeshStandardMaterial).opacity).toBe(0.4);
      expect((mat as THREE.MeshStandardMaterial).transparent).toBe(true);
    }
  });
});
