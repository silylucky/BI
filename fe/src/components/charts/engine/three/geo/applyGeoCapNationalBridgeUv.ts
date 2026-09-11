import * as THREE from "three";
import { uvFromBboxPosition } from "@/components/charts/engine/three/geo/applyGeoCapBboxUv";
import type { GeoProjBounds } from "@/components/charts/engine/three/geo/applyGeoTerrainSurface";
import type { ThreeGeoProjectContext } from "@/components/charts/engine/three/geo/threeGeoProject";

export type GeoCapNationalUvBridge = {
  local: Pick<
    ThreeGeoProjectContext,
    "projection" | "viewport" | "margin" | "centerX" | "centerY"
  >;
  national: Pick<ThreeGeoProjectContext, "project" | "projBounds">;
};

function meshToLngLat(
  x: number,
  y: number,
  local: GeoCapNationalUvBridge["local"],
): [number, number] | null {
  const { projection, viewport, margin, centerX, centerY } = local;
  const px = x + centerX + viewport.width / 2 - margin.left;
  const py = viewport.height / 2 - (y + centerY) - margin.top;
  const lngLat = projection.invert?.([px, py]);
  if (!lngLat) return null;
  return [lngLat[0], lngLat[1]];
}

/** 下钻：局部 mesh 坐标 → 经纬度 → 全国 projBounds UV（复用全国卫星贴图） */
export function capUvViaNationalBridge(
  x: number,
  y: number,
  bridge: GeoCapNationalUvBridge,
): [number, number] {
  const lngLat = meshToLngLat(x, y, bridge.local);
  if (!lngLat) return [0.5, 0.5];
  const np = bridge.national.project(lngLat);
  if (!np) return [0.5, 0.5];
  return uvFromBboxPosition(np[0], np[1], bridge.national.projBounds);
}

export function applyGeoCapNationalBridgeUv(
  geometry: THREE.BufferGeometry,
  bridge: GeoCapNationalUvBridge,
): THREE.BufferGeometry {
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const uvs = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i += 1) {
    const [u, v] = capUvViaNationalBridge(pos.getX(i), pos.getY(i), bridge);
    uvs[i * 2] = u;
    uvs[i * 2 + 1] = v;
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  return geometry;
}

/** @internal vitest：全国 bake projBounds 采样对照 */
export function nationalUvForLngLat(
  lng: number,
  lat: number,
  national: Pick<ThreeGeoProjectContext, "project" | "projBounds">,
): [number, number] {
  const p = national.project([lng, lat]);
  if (!p) return [0.5, 0.5];
  return uvFromBboxPosition(p[0], p[1], national.projBounds as GeoProjBounds);
}
