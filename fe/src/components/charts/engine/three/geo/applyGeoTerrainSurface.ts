import type * as d3 from "d3";
import * as THREE from "three";
import { lngLatToMercatorCapUv } from "@/lib/geoMercatorUv";
import type { TerrainGeoBounds } from "@/components/charts/engine/three/geo/chinaTerrainLoader";

export type GeoProjBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export function computeGeoProjBounds(
  features: Array<{ geometry: GeoJSON.Geometry | null }>,
  project: (coord: [number, number]) => [number, number] | null,
): GeoProjBounds {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  const visit = (coord: [number, number]) => {
    const p = project(coord);
    if (!p) return;
    minX = Math.min(minX, p[0]);
    maxX = Math.max(maxX, p[0]);
    minY = Math.min(minY, p[1]);
    maxY = Math.max(maxY, p[1]);
  };

  const walk = (geometry: GeoJSON.Geometry) => {
    if (geometry.type === "Polygon") {
      for (const ring of geometry.coordinates) {
        for (const c of ring) visit(c as [number, number]);
      }
    } else if (geometry.type === "MultiPolygon") {
      for (const poly of geometry.coordinates) {
        for (const ring of poly) {
          for (const c of ring) visit(c as [number, number]);
        }
      }
    }
  };

  for (const f of features) {
    if (f.geometry) walk(f.geometry);
  }

  const padX = (maxX - minX) * 0.02 || 1;
  const padY = (maxY - minY) * 0.02 || 1;
  return {
    minX: minX - padX,
    maxX: maxX + padX,
    minY: minY - padY,
    maxY: maxY + padY,
  };
}

export type GeoMapLayoutMargin = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

type TerrainSurfaceOpts = {
  geoBounds: TerrainGeoBounds;
  projBounds: GeoProjBounds;
  depth: number;
  projection: d3.GeoProjection;
  viewport: { width: number; height: number };
  margin: GeoMapLayoutMargin;
  centerX: number;
  centerY: number;
};

/** 投影平面 UV：与 mesh 同 Mercator 平面，hillshade 纹理按 projBounds 铺展 */
function capUvFromPosition(x: number, y: number, opts: TerrainSurfaceOpts): [number, number] {
  const { geoBounds, projBounds, projection, viewport, margin, centerX, centerY } = opts;
  const spanX = projBounds.maxX - projBounds.minX || 1;
  const spanY = projBounds.maxY - projBounds.minY || 1;

  const px = x + centerX + viewport.width / 2 - margin.left;
  const py = viewport.height / 2 - (y + centerY) - margin.top;
  const lngLat = projection.invert?.([px, py]);
  if (lngLat) {
    const [u, v] = lngLatToMercatorCapUv(lngLat[0], lngLat[1], geoBounds);
    if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
      return [u, v];
    }
  }

  const u = (x - projBounds.minX) / spanX;
  const v = 1 - (y - projBounds.minY) / spanY;
  if (!Number.isFinite(u) || !Number.isFinite(v)) return [0.5, 0.5];
  return [Math.max(0, Math.min(1, u)), Math.max(0, Math.min(1, v))];
}

function isTopCapVertex(z: number, depth: number): boolean {
  return z >= depth - 1e-4;
}

function writeCapUvsForRange(
  pos: THREE.BufferAttribute,
  uvs: Float32Array,
  start: number,
  count: number,
  depth: number,
  opts: TerrainSurfaceOpts,
): void {
  for (let i = start; i < start + count; i += 1) {
    if (!isTopCapVertex(pos.getZ(i), depth)) continue;
    const [u, v] = capUvFromPosition(pos.getX(i), pos.getY(i), opts);
    uvs[i * 2] = u;
    uvs[i * 2 + 1] = v;
  }
}

/** 写入 cap UV；不 mergeVertices */
export function applyTerrainToExtrudeGeometry(
  geometry: THREE.ExtrudeGeometry,
  opts: TerrainSurfaceOpts,
): THREE.ExtrudeGeometry {
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const uvs = new Float32Array(pos.count * 2);
  const { depth } = opts;

  const capGroups = geometry.groups.filter((g) => g.materialIndex === 1);
  if (capGroups.length > 0) {
    for (const group of capGroups) {
      writeCapUvsForRange(pos, uvs, group.start, group.count, depth, opts);
    }
  } else {
    writeCapUvsForRange(pos, uvs, 0, pos.count, depth, opts);
  }

  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  return geometry;
}

export function lngLatToTerrainUv(
  lng: number,
  lat: number,
  geoBounds: TerrainGeoBounds,
): [number, number] {
  return lngLatToMercatorCapUv(lng, lat, geoBounds);
}

export type TerrainCapSource = "satellite" | "procedural";

/** 数据色乘算：卫星底图保留彩色，指标色半透明叠加 */
export function computeCapTintColor(
  dataTint: THREE.Color,
  valueT: number,
  isDark = false,
  source: TerrainCapSource = "satellite",
  tintMixScale = 1,
): THREE.Color {
  const baseMix =
    source === "satellite" ? 0.22 + valueT * 0.38 : 0.08 + valueT * 0.22;
  const tintMix = Math.min(0.92, baseMix * tintMixScale);
  let color = new THREE.Color(0xffffff).lerp(dataTint, tintMix);
  if (isDark && source !== "satellite") {
    color = color.lerp(new THREE.Color(0xcccccc), 0.1);
  }
  return color;
}

export type TerrainCapBuildOpts = {
  source?: TerrainCapSource;
  tintMixScale?: number;
  techSatelliteOverlay?: boolean;
  capEmissiveIntensity?: number;
  capMetalness?: number;
  capRoughness?: number;
};

export function buildTerrainCapMaterial(
  terrainMap: THREE.Texture,
  normalMap: THREE.Texture | undefined,
  dataTint: THREE.Color,
  valueT: number,
  isDark: boolean,
  opts: TerrainCapBuildOpts = {},
): THREE.MeshBasicMaterial | THREE.MeshStandardMaterial {
  const {
    source = "satellite",
    tintMixScale = 1,
    techSatelliteOverlay = false,
    capEmissiveIntensity,
    capMetalness = 0.2,
    capRoughness = 0.5,
  } = opts;
  terrainMap.colorSpace = THREE.SRGBColorSpace;
  const tint = computeCapTintColor(dataTint, valueT, isDark, source, tintMixScale);

  if (source === "satellite" && techSatelliteOverlay) {
    const emissive = new THREE.Color(isDark ? 0x1a6aaa : 0x3b82f6);
    return new THREE.MeshStandardMaterial({
      map: terrainMap,
      color: tint,
      emissive,
      emissiveIntensity: capEmissiveIntensity ?? (isDark ? 0.22 + valueT * 0.28 : 0.14 + valueT * 0.2),
      metalness: capMetalness,
      roughness: capRoughness,
      side: THREE.FrontSide,
    });
  }

  if (source === "satellite") {
    return new THREE.MeshBasicMaterial({
      map: terrainMap,
      color: tint,
      side: THREE.FrontSide,
    });
  }

  const emissiveIntensity =
    capEmissiveIntensity ?? (isDark ? 0.1 : 0.05);
  return new THREE.MeshStandardMaterial({
    map: terrainMap,
    normalMap: normalMap ?? null,
    color: tint,
    emissive: tint.clone(),
    emissiveIntensity,
    metalness: capMetalness,
    roughness: capRoughness,
    side: THREE.FrontSide,
  });
}
