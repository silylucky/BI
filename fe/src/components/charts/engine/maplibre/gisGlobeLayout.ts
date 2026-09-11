import type { GisAtmospherePreset, GisProjection } from "@/components/charts/engine/maplibre/gisProject";

type MapLibreMap = import("maplibre-gl").Map;

export type GlobeScreenBounds = {
  x: number;
  y: number;
  radius: number;
  bearing: number;
  pitch: number;
  centerLng: number;
  centerLat: number;
};

type MapTransform = {
  centerPoint: { x: number; y: number };
  worldSize: number;
  center: { lat: number };
  width: number;
  height: number;
};

/** 与 MapLibre globe 投影内部算法一致。 */
export function getGlobeRadiusPixels(worldSize: number, latitudeDegrees: number): number {
  const latRad = (latitudeDegrees * Math.PI) / 180;
  const cosLat = Math.cos(latRad);
  if (!Number.isFinite(cosLat) || Math.abs(cosLat) < 1e-6) {
    return worldSize / (2 * Math.PI);
  }
  return worldSize / (2 * Math.PI) / cosLat;
}

export function resolveGlobeScreenBounds(map: MapLibreMap | null): GlobeScreenBounds | null {
  if (!map) return null;

  const transform = (map as unknown as { transform?: MapTransform }).transform;
  if (!transform?.centerPoint || !Number.isFinite(transform.worldSize)) return null;

  const width = transform.width || map.getContainer().clientWidth;
  const height = transform.height || map.getContainer().clientHeight;
  if (width <= 0 || height <= 0) return null;

  const radius = getGlobeRadiusPixels(transform.worldSize, transform.center.lat);
  const pitch = map.getPitch();
  const pitchScale = Math.max(0.35, Math.cos((pitch * Math.PI) / 180));

  const center = map.getCenter();

  return {
    x: transform.centerPoint.x,
    y: transform.centerPoint.y,
    radius: radius * pitchScale,
    bearing: map.getBearing(),
    pitch,
    centerLng: center.lng,
    centerLat: center.lat,
  };
}

/** 仅用于 map 尚未挂载时的星场占位；光晕禁止用此 fallback（会与真实球缘脱节）。 */
export function resolveGlobeScreenBoundsFallback(
  width: number,
  height: number,
): GlobeScreenBounds {
  const radius = Math.min(width, height) * 0.42;
  return { x: width / 2, y: height / 2, radius, bearing: 0, pitch: 0, centerLng: 100, centerLat: 28 };
}

/** 星空与球面同向旋转：bearing + 中心经度。 */
export function resolveGlobeStarViewRotation(globe: GlobeScreenBounds): number {
  return globe.bearing + globe.centerLng;
}

export function isInsideGlobeDisc(
  x: number,
  y: number,
  globe: GlobeScreenBounds,
  inset = 0.98,
): boolean {
  const dx = x - globe.x;
  const dy = y - globe.y;
  const r = globe.radius * inset;
  return dx * dx + dy * dy < r * r;
}

/** zoom 超过此值视为区域视图，隐藏星场/流星（光晕仍跟随球缘绘制）。 */
export const GIS_GLOBE_FAR_EFFECTS_MAX_ZOOM = 4.5;

/** 全球远视图才显示星场/流星；区域放大后隐藏，避免球缘 overlay 伪影。光晕不在此门控内。 */
export function shouldRenderGisGlobeFarEffects(
  map: MapLibreMap | null,
  globe: GlobeScreenBounds | null,
  width: number,
  height: number,
): boolean {
  if (width <= 0 || height <= 0) return false;
  if (map && map.getZoom() > GIS_GLOBE_FAR_EFFECTS_MAX_ZOOM) return false;
  if (!globe) return true;
  const viewportMin = Math.min(width, height);
  // 球盘几乎铺满视口时隐藏（与 zoom 互补，防止 halo 贴边伪影）
  return globe.radius * 0.88 <= viewportMin * 0.92;
}

export function shouldRenderGisStarfield(
  globe: GlobeScreenBounds,
  width: number,
  height: number,
  map: MapLibreMap | null = null,
): boolean {
  return shouldRenderGisGlobeFarEffects(map, globe, width, height);
}

export function bindMapRenderSync(map: MapLibreMap | null, paint: () => void): () => void {
  if (!map) return () => undefined;
  const onRender = () => paint();
  const events = [
    "render",
    "move",
    "rotate",
    "pitch",
    "zoom",
    "resize",
    "idle",
    "moveend",
    "style.load",
  ] as const;
  for (const event of events) {
    map.on(event, onRender);
  }
  return () => {
    for (const event of events) {
      map.off(event, onRender);
    }
  };
}

export type GlobeLimbBounds = {
  x: number;
  y: number;
  radius: number;
};

type SurfaceProbeTransform = {
  centerPoint: { x: number; y: number };
  width: number;
  height: number;
  isPointOnMapSurface: (point: { x: number; y: number }) => boolean;
};

function isOnGlobeSurface(transform: SurfaceProbeTransform, x: number, y: number): boolean {
  return transform.isPointOnMapSurface({ x, y });
}

function raycastGlobeEdgeAlongBearing(
  transform: SurfaceProbeTransform,
  cx: number,
  cy: number,
  angle: number,
): { x: number; y: number; radius: number } | null {
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  const maxScan = Math.max(transform.width, transform.height) * 0.75;
  let lo = 0;
  let hi = maxScan;

  for (let step = 0; step < 14; step += 1) {
    const mid = (lo + hi) / 2;
    if (isOnGlobeSurface(transform, cx + dirX * mid, cy + dirY * mid)) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  if (lo <= 0.5) return null;
  return { x: cx + dirX * lo, y: cy + dirY * lo, radius: lo };
}

/** 沿球面 90° 采样 + map.project（GeoLibre / Leonel Dias）。 */
export function resolveGlobeLimbBoundsFromProject(map: MapLibreMap): GlobeLimbBounds | null {
  const center = map.getCenter();
  const clng = (center.lng * Math.PI) / 180;
  const clat = (center.lat * Math.PI) / 180;
  const points: { x: number; y: number }[] = [];
  const numSamples = 16;

  for (let i = 0; i < numSamples; i += 1) {
    const bearing = (i / numSamples) * 2 * Math.PI;
    const edgeLat = Math.asin(
      Math.sin(clat) * Math.cos(Math.PI / 2) +
        Math.cos(clat) * Math.sin(Math.PI / 2) * Math.cos(bearing),
    );
    const edgeLng =
      clng +
      Math.atan2(
        Math.sin(bearing) * Math.sin(Math.PI / 2) * Math.cos(clat),
        Math.cos(Math.PI / 2) - Math.sin(clat) * Math.sin(edgeLat),
      );
    const px = map.project([(edgeLng * 180) / Math.PI, (edgeLat * 180) / Math.PI]);
    if (Number.isFinite(px.x) && Number.isFinite(px.y)) {
      points.push(px);
    }
  }

  if (points.length < 3) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }

  return {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
    radius: Math.max(maxX - minX, maxY - minY) / 2,
  };
}

/** 用 MapLibre transform 的球面探测对齐真实渲染球缘（zoom / pitch 均跟随）。 */
export function resolveGlobeLimbBoundsFromMap(map: MapLibreMap): GlobeLimbBounds | null {
  const transform = (map as unknown as { transform?: SurfaceProbeTransform }).transform;
  if (!transform?.centerPoint || typeof transform.isPointOnMapSurface !== "function") {
    return null;
  }
  if (transform.width <= 0 || transform.height <= 0) return null;

  const cx = transform.centerPoint.x;
  const cy = transform.centerPoint.y;

  const edges: { x: number; y: number }[] = [];
  const bearings = 64;
  for (let i = 0; i < bearings; i += 1) {
    const angle = (i / bearings) * Math.PI * 2;
    const hit = raycastGlobeEdgeAlongBearing(transform, cx, cy, angle);
    if (hit) edges.push({ x: hit.x, y: hit.y });
  }

  if (edges.length < 8) return null;

  let radius = 0;
  for (const edge of edges) {
    radius += Math.hypot(edge.x - cx, edge.y - cy);
  }
  radius /= edges.length;

  if (!Number.isFinite(radius) || radius <= 0) return null;
  return { x: cx, y: cy, radius };
}

export function offsetMapPixelToOverlay(
  map: MapLibreMap,
  overlay: HTMLElement,
  point: GlobeLimbBounds,
): GlobeLimbBounds {
  const mapContainer = map.getContainer();
  if (mapContainer === overlay) {
    return point;
  }

  let offsetX = 0;
  let offsetY = 0;
  let node: HTMLElement | null = mapContainer;
  while (node && node !== overlay) {
    offsetX += node.offsetLeft;
    offsetY += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  if (node === overlay) {
    return {
      x: point.x + offsetX,
      y: point.y + offsetY,
      radius: point.radius,
    };
  }

  const mapRect = mapContainer.getBoundingClientRect();
  const overlayRect = overlay.getBoundingClientRect();
  const overlayLayoutW = overlay.clientWidth || overlayRect.width || 1;
  const overlayLayoutH = overlay.clientHeight || overlayRect.height || 1;
  const scaleX = overlayLayoutW > 0 ? overlayRect.width / overlayLayoutW : 1;
  const scaleY = overlayLayoutH > 0 ? overlayRect.height / overlayLayoutH : 1;
  return {
    x: point.x + (mapRect.left - overlayRect.left) / scaleX,
    y: point.y + (mapRect.top - overlayRect.top) / scaleY,
    radius: point.radius,
  };
}

function clampGlobeLimbToScreenBounds(
  limb: GlobeLimbBounds,
  screen: GlobeScreenBounds,
  overlay: HTMLElement,
  map: MapLibreMap,
): GlobeLimbBounds {
  const screenLimb =
    map.getContainer() === overlay
      ? { x: screen.x, y: screen.y, radius: screen.radius }
      : offsetMapPixelToOverlay(map, overlay, { x: screen.x, y: screen.y, radius: screen.radius });
  const maxRadius = screenLimb.radius * 1.12;
  if (limb.radius <= maxRadius) return limb;
  return screenLimb;
}

/** MapLibre globe transform 是否具备球面探测能力（style 切换/首帧前为 false）。 */
export function isGlobeTransformProbeReady(map: MapLibreMap | null): boolean {
  if (!map || !map.isStyleLoaded()) return false;
  const transform = (map as unknown as { transform?: SurfaceProbeTransform & MapTransform }).transform;
  if (!transform?.centerPoint || !Number.isFinite(transform.worldSize)) return false;
  if (transform.width <= 0 || transform.height <= 0) return false;
  return typeof transform.isPointOnMapSurface === "function";
}

/** 多策略解析球缘，并映射到 overlay 容器坐标（实时跟 zoom；探测未就绪时返回 null，禁止 viewport fallback）。 */
export function resolveGlobeLimbBoundsForOverlay(
  map: MapLibreMap | null,
  overlay: HTMLElement,
  width: number,
  height: number,
): GlobeLimbBounds | null {
  if (!map || !isGlobeTransformProbeReady(map)) {
    return null;
  }

  const screen = resolveGlobeScreenBounds(map);
  const inMapPixels =
    resolveGlobeLimbBoundsFromMap(map) ??
    resolveGlobeLimbBoundsFromProject(map) ??
    (screen ? { x: screen.x, y: screen.y, radius: screen.radius } : null);
  if (!inMapPixels) {
    return null;
  }

  const limbInOverlay =
    map.getContainer() === overlay
      ? inMapPixels
      : offsetMapPixelToOverlay(map, overlay, inMapPixels);

  if (screen) {
    return clampGlobeLimbToScreenBounds(limbInOverlay, screen, overlay, map);
  }
  return limbInOverlay;
}

/**
 * 光晕绘制专用球缘：transform 球面探测优先（旋转时更稳），project 地平线采样兜底。
 */
export function resolveGlobeLimbBoundsForHaloPaint(
  map: MapLibreMap | null,
  overlay: HTMLElement,
  width: number,
  height: number,
): GlobeLimbBounds | null {
  if (!map || !map.isStyleLoaded() || width <= 0 || height <= 0) {
    return null;
  }
  try {
    if (map.getProjection()?.type !== "globe") return null;
  } catch {
    return null;
  }

  const screen = resolveGlobeScreenBounds(map);
  const inMapPixels =
    (isGlobeTransformProbeReady(map) ? resolveGlobeLimbBoundsFromMap(map) : null) ??
    resolveGlobeLimbBoundsFromProject(map) ??
    (screen ? { x: screen.x, y: screen.y, radius: screen.radius } : null);
  if (!inMapPixels) {
    return null;
  }

  const limbInOverlay =
    map.getCanvasContainer() === overlay || map.getContainer() === overlay
      ? inMapPixels
      : offsetMapPixelToOverlay(map, overlay, inMapPixels);

  if (screen) {
    return clampGlobeLimbToScreenBounds(limbInOverlay, screen, overlay, map);
  }
  return limbInOverlay;
}
