import type * as d3 from "d3";
import * as THREE from "three";
import { lngLatToMercatorCapUv } from "@/lib/geoMercatorUv";
import type { TerrainGeoBounds } from "@/components/charts/engine/three/geo/chinaTerrainLoader";
import type {
  GeoMapLayoutMargin,
  GeoProjBounds,
} from "@/components/charts/engine/three/geo/applyGeoTerrainSurface";

export type GeoCapGeoUvContext = {
  geoBounds: TerrainGeoBounds;
  projBounds: GeoProjBounds;
  projection: d3.GeoProjection;
  viewport: { width: number; height: number };
  margin: GeoMapLayoutMargin;
  centerX: number;
  centerY: number;
};

export function lngLatToTerrainCapUv(
  lng: number,
  lat: number,
  geoBounds: TerrainGeoBounds,
): [number, number] {
  return lngLatToMercatorCapUv(lng, lat, geoBounds);
}

export function capUvFromGeoContext(
  x: number,
  y: number,
  ctx: GeoCapGeoUvContext,
): [number, number] {
  const { geoBounds, projBounds, projection, viewport, margin, centerX, centerY } = ctx;
  const px = x + centerX + viewport.width / 2 - margin.left;
  const py = viewport.height / 2 - (y + centerY) - margin.top;
  const lngLat = projection.invert?.([px, py]);
  if (lngLat) {
    const [u, v] = lngLatToTerrainCapUv(lngLat[0], lngLat[1], geoBounds);
    if (u >= 0 && u <= 1 && v >= 0 && v <= 1) return [u, v];
  }

  const spanX = projBounds.maxX - projBounds.minX || 1;
  const spanY = projBounds.maxY - projBounds.minY || 1;
  const u = (x - projBounds.minX) / spanX;
  const v = 1 - (y - projBounds.minY) / spanY;
  if (!Number.isFinite(u) || !Number.isFinite(v)) return [0.5, 0.5];
  return [Math.max(0, Math.min(1, u)), Math.max(0, Math.min(1, v))];
}

/** 卫星纹理：顶点反投影到经纬度，再按 meta.bounds Web Mercator Y 归一化 */
export function applyGeoCapGeoUv(
  geometry: THREE.BufferGeometry,
  ctx: GeoCapGeoUvContext,
): THREE.BufferGeometry {
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const uvs = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i += 1) {
    const [u, v] = capUvFromGeoContext(pos.getX(i), pos.getY(i), ctx);
    uvs[i * 2] = u;
    uvs[i * 2 + 1] = v;
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  return geometry;
}
