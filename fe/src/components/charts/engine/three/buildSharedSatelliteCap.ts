import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { applyGeoCapBboxUv } from "@/components/charts/engine/three/geo/applyGeoCapBboxUv";
import type { GeoProjBounds } from "@/components/charts/engine/three/geo/applyGeoTerrainSurface";
import { GEO_CAP_Z_EPS } from "@/components/charts/engine/three/buildGeoFlatPlateMesh";

/** 全国卫星底图：合并全部省顶盖为单 mesh，消除省界缝隙 */
export function buildSharedSatelliteCap(
  shapes: THREE.Shape[],
  depth: number,
  projBounds: GeoProjBounds,
  terrainColorMap: THREE.Texture,
): THREE.Mesh {
  const parts: THREE.BufferGeometry[] = [];
  for (const shape of shapes) {
    const geom = new THREE.ShapeGeometry(shape);
    applyGeoCapBboxUv(geom, projBounds);
    parts.push(geom);
  }
  const merged = mergeGeometries(parts, false);
  for (const geom of parts) geom.dispose();
  if (!merged) {
    throw new Error("shared satellite cap merge failed");
  }

  terrainColorMap.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({
    map: terrainColorMap,
    color: 0xffffff,
    side: THREE.FrontSide,
  });
  const mesh = new THREE.Mesh(merged, material);
  mesh.position.z = depth + GEO_CAP_Z_EPS;
  mesh.renderOrder = 0;
  return mesh;
}
