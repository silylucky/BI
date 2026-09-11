import * as THREE from "three";
import type { GeoProjBounds } from "@/components/charts/engine/three/geo/applyGeoTerrainSurface";

export function uvFromBboxPosition(x: number, y: number, bbox: GeoProjBounds): [number, number] {
  const spanX = bbox.maxX - bbox.minX || 1;
  const spanY = bbox.maxY - bbox.minY || 1;
  const u = (x - bbox.minX) / spanX;
  const v = (y - bbox.minY) / spanY;
  if (!Number.isFinite(u) || !Number.isFinite(v)) return [0.5, 0.5];
  return [Math.max(0, Math.min(1, u)), Math.max(0, Math.min(1, v))];
}

/** sc-datav Demo1 shape.tsx：全省共用 projBounds 铺展纹理 */
export function applyGeoCapBboxUv(
  geometry: THREE.BufferGeometry,
  bbox: GeoProjBounds,
): THREE.BufferGeometry {
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const uvs = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i += 1) {
    const [u, v] = uvFromBboxPosition(pos.getX(i), pos.getY(i), bbox);
    uvs[i * 2] = u;
    uvs[i * 2 + 1] = v;
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  return geometry;
}
