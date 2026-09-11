import * as THREE from "three";
import { createGeoSideShiftMaterial } from "@/components/charts/engine/three/threeGeoShiftMaterial";

export type GeoExtrudeMesh = {
  mesh: THREE.Mesh;
  sideMaterial: THREE.ShaderMaterial;
  edgeLines: THREE.LineSegments;
};

/** 顶面叠加数据色，零值区仍可见 */
export function blendGeoCapColor(dataColor: number, valueT: number): THREE.Color {
  const base = new THREE.Color(0x3d4f5f);
  const tint = new THREE.Color(dataColor);
  const mix = 0.38 + valueT * 0.52;
  return base.lerp(tint, mix);
}

export function buildGeoExtrudeMesh(
  shape: THREE.Shape,
  depth: number,
  capColor: number,
  isDark: boolean,
  valueT = 1,
): GeoExtrudeMesh {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
  });

  const sideMaterial = createGeoSideShiftMaterial(depth, {
    top: isDark ? "#8fc2ff" : "#60a5fa",
    bottom: isDark ? "#10182c" : "#1e3a5f",
    scan: isDark ? "#8fc2ff" : "#38bdf8",
  });
  const capTint = blendGeoCapColor(capColor, valueT);
  const capMaterial = new THREE.MeshStandardMaterial({
    color: capTint,
    emissive: capTint,
    emissiveIntensity: 0.22 + valueT * 0.38,
    metalness: 0.28,
    roughness: 0.55,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, [sideMaterial, capMaterial]);
  mesh.userData.capMaterial = capMaterial;

  const edges = new THREE.EdgesGeometry(geometry, 12);
  const edgeLines = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.72,
    }),
  );
  edgeLines.position.z = depth + 0.04;
  mesh.add(edgeLines);

  return { mesh, sideMaterial, edgeLines };
}
