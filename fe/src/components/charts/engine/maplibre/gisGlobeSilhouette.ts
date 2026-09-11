import type { MapLibreMap } from "maplibre-gl";

export type GlobeSilhouette = {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rotation: number;
};

type SurfaceProbeTransform = {
  centerPoint: { x: number; y: number };
  width: number;
  height: number;
  isPointOnMapSurface: (point: { x: number; y: number }) => boolean;
};

const LIMB_SAMPLE_COUNT = 64;
const limbRadiusSeed: number[] = [];

function readTransform(map: MapLibreMap): SurfaceProbeTransform | null {
  const transform = (map as unknown as { transform?: SurfaceProbeTransform }).transform;
  if (!transform?.centerPoint || typeof transform.isPointOnMapSurface !== "function") {
    return null;
  }
  if (transform.width <= 0 || transform.height <= 0) return null;
  return transform;
}

function isOnGlobeSurface(transform: SurfaceProbeTransform, x: number, y: number): boolean {
  return transform.isPointOnMapSurface({ x, y });
}

/** GeoLibre #230：沿屏幕射线二分，种子半径加速收敛。 */
export function rayToLimbPoint(
  transform: SurfaceProbeTransform,
  cx: number,
  cy: number,
  angle: number,
  sampleIndex: number,
): { x: number; y: number } | null {
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  const maxScan = Math.max(transform.width, transform.height) * 0.75;
  const seed = limbRadiusSeed[sampleIndex];
  let lo = 0;
  let hi = seed && seed > 8 ? Math.min(maxScan, seed * 1.1) : maxScan;

  if (seed && seed > 8) {
    lo = Math.max(0, seed * 0.9);
  }

  if (isOnGlobeSurface(transform, cx + dirX * hi, cy + dirY * hi)) {
    while (hi < maxScan && isOnGlobeSurface(transform, cx + dirX * hi, cy + dirY * hi)) {
      hi = Math.min(maxScan, hi + 12);
    }
  }

  for (let step = 0; step < 14; step += 1) {
    const mid = (lo + hi) / 2;
    if (isOnGlobeSurface(transform, cx + dirX * mid, cy + dirY * mid)) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  if (lo <= 0.5) return null;
  limbRadiusSeed[sampleIndex] = lo;
  return { x: cx + dirX * lo, y: cy + dirY * lo };
}

/** 透视 pitch 下 silhouette 为椭圆：PCA 拟合轴与旋转。 */
export function fitEllipseFromLimbPoints(
  points: { x: number; y: number }[],
): GlobeSilhouette | null {
  if (points.length < 8) return null;

  const n = points.length;
  let cx = 0;
  let cy = 0;
  for (const point of points) {
    cx += point.x;
    cy += point.y;
  }
  cx /= n;
  cy /= n;

  let vxx = 0;
  let vyy = 0;
  let vxy = 0;
  for (const point of points) {
    const dx = point.x - cx;
    const dy = point.y - cy;
    vxx += dx * dx;
    vyy += dy * dy;
    vxy += dx * dy;
  }
  vxx /= n;
  vyy /= n;
  vxy /= n;

  const rotation = 0.5 * Math.atan2(2 * vxy, vxx - vyy);
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  let rx = 0;
  let ry = 0;
  for (const point of points) {
    const dx = point.x - cx;
    const dy = point.y - cy;
    const u = dx * cos + dy * sin;
    const v = -dx * sin + dy * cos;
    rx = Math.max(rx, Math.abs(u));
    ry = Math.max(ry, Math.abs(v));
  }

  if (!Number.isFinite(rx) || !Number.isFinite(ry) || rx <= 0 || ry <= 0) return null;
  return { cx, cy, rx, ry, rotation };
}

export function sampleGlobeLimbPoints(map: MapLibreMap): { x: number; y: number }[] | null {
  const transform = readTransform(map);
  if (!transform) return null;

  const cx = transform.centerPoint.x;
  const cy = transform.centerPoint.y;
  const points: { x: number; y: number }[] = [];

  for (let i = 0; i < LIMB_SAMPLE_COUNT; i += 1) {
    const angle = (i / LIMB_SAMPLE_COUNT) * Math.PI * 2;
    const hit = rayToLimbPoint(transform, cx, cy, angle, i);
    if (hit) points.push(hit);
  }

  if (points.length < 8) return null;
  return points;
}

export function resolveGlobeSilhouetteFromMap(map: MapLibreMap): GlobeSilhouette | null {
  const points = sampleGlobeLimbPoints(map);
  if (!points) return null;
  return fitEllipseFromLimbPoints(points);
}

export function offsetSilhouetteToOverlay(
  map: MapLibreMap,
  overlay: HTMLElement,
  silhouette: GlobeSilhouette,
): GlobeSilhouette {
  const mapRect = map.getContainer().getBoundingClientRect();
  const overlayRect = overlay.getBoundingClientRect();
  const dx = mapRect.left - overlayRect.left;
  const dy = mapRect.top - overlayRect.top;
  return {
    cx: silhouette.cx + dx,
    cy: silhouette.cy + dy,
    rx: silhouette.rx,
    ry: silhouette.ry,
    rotation: silhouette.rotation,
  };
}

export function resolveGlobeSilhouetteForOverlay(
  map: MapLibreMap,
  overlay: HTMLElement,
): GlobeSilhouette | null {
  const inMapPixels = resolveGlobeSilhouetteFromMap(map);
  if (!inMapPixels) return null;
  return offsetSilhouetteToOverlay(map, overlay, inMapPixels);
}

export function silhouetteToLimbBounds(silhouette: GlobeSilhouette): {
  x: number;
  y: number;
  radius: number;
} {
  return {
    x: silhouette.cx,
    y: silhouette.cy,
    radius: Math.max(silhouette.rx, silhouette.ry),
  };
}
