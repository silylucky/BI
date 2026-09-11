import * as d3 from "d3";
import * as THREE from "three";

export type JoinedMapFeature = {
  name: string;
  value: number;
  adcode?: number;
  geometry: GeoJSON.Geometry | null;
  /** GeoJSON properties.centroid / center，官方标注点 */
  labelLngLat?: [number, number];
};

type ProjectFn = (coord: [number, number]) => [number, number] | null;

/** 从离线 GeoJSON 几何计算质心（lng, lat） */
export function resolveRegionCentroidLngLat(
  geometry: GeoJSON.Geometry | null | undefined,
): [number, number] | null {
  if (!geometry) return null;
  const feature: GeoJSON.Feature = { type: "Feature", properties: {}, geometry };
  const c = d3.geoCentroid(feature);
  if (!Number.isFinite(c[0]) || !Number.isFinite(c[1])) return null;
  return [c[0], c[1]];
}

function ringArea2(ring: [number, number][]): number {
  let area2 = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x0, y0] = ring[i]!;
    const [x1, y1] = ring[i + 1]!;
    area2 += x0 * y1 - x1 * y0;
  }
  return area2 * 0.5;
}

function ringCentroidProjected(
  ring: [number, number][],
  project: ProjectFn,
): [number, number] | null {
  const pts: [number, number][] = [];
  for (const coord of ring) {
    const p = project(coord);
    if (p) pts.push(p);
  }
  if (pts.length === 0) return null;
  if (pts.length < 3) {
    const sx = pts.reduce((sum, p) => sum + p[0], 0) / pts.length;
    const sy = pts.reduce((sum, p) => sum + p[1], 0) / pts.length;
    return [sx, sy];
  }
  const area2 = ringArea2(pts) * 2;
  if (Math.abs(area2) < 1e-6) {
    const sx = pts.reduce((sum, p) => sum + p[0], 0) / pts.length;
    const sy = pts.reduce((sum, p) => sum + p[1], 0) / pts.length;
    return [sx, sy];
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const [x0, y0] = pts[i]!;
    const [x1, y1] = pts[i + 1]!;
    const cross = x0 * y1 - x1 * y0;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  return [cx / (3 * area2), cy / (3 * area2)];
}

function polygonOuterRing(geometry: GeoJSON.Polygon): [number, number][] | null {
  const outer = geometry.coordinates[0] as [number, number][] | undefined;
  return outer ?? null;
}

/** 与 mesh 顶点同一投影平面上的质心（MultiPolygon 按投影面积加权） */
export function resolveRegionCentroidProjected(
  geometry: GeoJSON.Geometry | null | undefined,
  project: ProjectFn,
): [number, number] | null {
  if (!geometry) return null;
  if (geometry.type === "Polygon") {
    const outer = polygonOuterRing(geometry);
    return outer ? ringCentroidProjected(outer, project) : null;
  }
  if (geometry.type === "MultiPolygon") {
    let sumX = 0;
    let sumY = 0;
    let weight = 0;
    for (const poly of geometry.coordinates) {
      const outer = poly[0] as [number, number][] | undefined;
      if (!outer) continue;
      const projected: [number, number][] = [];
      for (const coord of outer) {
        const p = project(coord);
        if (p) projected.push(p);
      }
      if (projected.length < 3) continue;
      const area = Math.abs(ringArea2(projected));
      const c = ringCentroidProjected(outer, project);
      if (!c || area <= 1e-6) continue;
      sumX += c[0] * area;
      sumY += c[1] * area;
      weight += area;
    }
    if (weight <= 0) return null;
    return [sumX / weight, sumY / weight];
  }
  if (geometry.type === "Point") {
    return project(geometry.coordinates as [number, number]);
  }
  return null;
}

/**
 * 点位锚点：优先 GeoJSON 官方 centroid/center，再回退投影面积加权质心。
 * 光柱 / 标签 / capAnchor 必须共用此函数。
 */
export function resolveRegionAnchorProjected(
  feature: Pick<JoinedMapFeature, "geometry" | "labelLngLat">,
  project: ProjectFn,
): [number, number] | null {
  if (feature.labelLngLat) {
    const projected = project(feature.labelLngLat);
    if (projected) return projected;
  }
  return resolveRegionCentroidProjected(feature.geometry, project);
}

export type RegionPointSample = {
  name: string;
  value: number;
  adcode?: number;
  /** 投影平面坐标（与 threeGeoProject.project 一致） */
  x: number;
  y: number;
  valueT: number;
};

export function buildRegionPointSamples(
  features: JoinedMapFeature[],
  project: ProjectFn,
  minVal: number,
  maxVal: number,
): RegionPointSample[] {
  const span = maxVal - minVal;
  const samples: RegionPointSample[] = [];
  for (const feature of features) {
    const projected = resolveRegionAnchorProjected(feature, project);
    if (!projected) continue;
    const valueT = span <= 0 ? 1 : (feature.value - minVal) / span;
    samples.push({
      name: feature.name,
      value: feature.value,
      adcode: feature.adcode,
      x: projected[0],
      y: projected[1],
      valueT: Math.min(1, Math.max(0, valueT)),
    });
  }
  return samples;
}

function meshMatchesRegion(mesh: THREE.Object3D, name: string, adcode?: number): boolean {
  if (adcode != null && mesh.userData?.adcode != null) {
    return Number(mesh.userData.adcode) === adcode;
  }
  return String(mesh.userData?.name ?? "") === name;
}

export function resolveRegionCapAnchorLocal(
  meshes: THREE.Object3D[],
  name: string,
  capTopZ: number,
  adcode?: number,
): { x: number; y: number; z: number } | null {
  for (const mesh of meshes) {
    if (!meshMatchesRegion(mesh, name, adcode)) continue;
    const local = mesh.userData.capAnchorLocal as THREE.Vector3 | undefined;
    if (!local) continue;
    return { x: local.x, y: local.y, z: capTopZ };
  }
  return null;
}

export function resolveRegionCapAnchorWorld(
  meshes: THREE.Object3D[],
  name: string,
  mapGroup: THREE.Group,
  capTopZ: number,
  extraZ: number,
  target = new THREE.Vector3(),
  adcode?: number,
): THREE.Vector3 | null {
  const local = resolveRegionCapAnchorLocal(meshes, name, capTopZ, adcode);
  if (!local) return null;
  mapGroup.updateMatrixWorld(true);
  return target.set(local.x, local.y, capTopZ + extraZ).applyMatrix4(mapGroup.matrixWorld);
}

export function resolvePillarTopWorld(
  pillarGroup: THREE.Object3D,
  barHeight: number,
  labelOffset: number,
  target = new THREE.Vector3(),
): THREE.Vector3 {
  pillarGroup.updateMatrixWorld(true);
  return target.set(0, 0, barHeight + labelOffset).applyMatrix4(pillarGroup.matrixWorld);
}