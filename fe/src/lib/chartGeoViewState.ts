import { GEO_MAP_SCALE_LIMIT } from "@/components/charts/engine/geo/geoConstants";
import {
  patchChartDeStyleNested,
  readChartDeStyle,
  readChartGeo3dStyle,
  readChartGeoStyle,
} from "@/lib/chartDeStyle";
import type { ChartViewConfig } from "@/lib/chartViewConfig";

export type ChartGeoViewTransform = {
  x: number;
  y: number;
  k: number;
};

export type ChartGeo3dOrbitView = {
  target: { x: number; y: number; z: number };
  position: { x: number; y: number; z: number };
};

const TRANSFORM_EPS = 1e-3;

export function isIdentityGeoViewTransform(transform: ChartGeoViewTransform): boolean {
  return (
    Math.abs(transform.k - 1) < TRANSFORM_EPS
    && Math.abs(transform.x) < TRANSFORM_EPS
    && Math.abs(transform.y) < TRANSFORM_EPS
  );
}

/** 拒绝看板缩放/拖拽后落盘的极端平移（会导致地图缩在角落） */
export function isValidGeoViewTransform(
  transform: ChartGeoViewTransform,
  width: number,
  height: number,
): boolean {
  if (
    !Number.isFinite(transform.x)
    || !Number.isFinite(transform.y)
    || !Number.isFinite(transform.k)
  ) {
    return false;
  }
  if (
    transform.k < GEO_MAP_SCALE_LIMIT.min - TRANSFORM_EPS
    || transform.k > GEO_MAP_SCALE_LIMIT.max + TRANSFORM_EPS
  ) {
    return false;
  }
  if (width <= 0 || height <= 0) return false;
  const sx = (width / 2) * transform.k + transform.x;
  const sy = (height / 2) * transform.k + transform.y;
  const slack = Math.max(width, height) * 0.25;
  return (
    sx >= -slack
    && sx <= width + slack
    && sy >= -slack
    && sy <= height + slack
  );
}

function roundGeoViewTransform(transform: ChartGeoViewTransform): ChartGeoViewTransform {
  return {
    x: Math.round(transform.x * 100) / 100,
    y: Math.round(transform.y * 100) / 100,
    k: Math.round(transform.k * 1000) / 1000,
  };
}

function roundOrbitComponent(value: number): number {
  return Math.round(value * 100) / 100;
}

export function roundGeo3dOrbitView(view: ChartGeo3dOrbitView): ChartGeo3dOrbitView {
  return {
    target: {
      x: roundOrbitComponent(view.target.x),
      y: roundOrbitComponent(view.target.y),
      z: roundOrbitComponent(view.target.z),
    },
    position: {
      x: roundOrbitComponent(view.position.x),
      y: roundOrbitComponent(view.position.y),
      z: roundOrbitComponent(view.position.z),
    },
  };
}

export function patchChartGeoViewTransform(
  cfg: ChartViewConfig,
  mapId: string,
  transform: ChartGeoViewTransform | undefined,
): ChartViewConfig {
  const geo = readChartGeoStyle(readChartDeStyle(cfg));
  const prev = { ...(geo.viewTransforms ?? {}) };
  if (!transform || isIdentityGeoViewTransform(transform)) {
    delete prev[mapId];
  } else {
    prev[mapId] = roundGeoViewTransform(transform);
  }
  return patchChartDeStyleNested(cfg, "geo", {
    viewTransforms: Object.keys(prev).length > 0 ? prev : undefined,
  });
}

export function patchChartGeo3dOrbitView(
  cfg: ChartViewConfig,
  mapId: string,
  view: ChartGeo3dOrbitView | undefined,
): ChartViewConfig {
  const geo3d = readChartGeo3dStyle(readChartDeStyle(cfg));
  const prev = { ...(geo3d.orbitViews ?? {}) };
  if (!view) {
    delete prev[mapId];
  } else {
    prev[mapId] = roundGeo3dOrbitView(view);
  }
  return patchChartDeStyleNested(cfg, "geo3d", {
    orbitViews: Object.keys(prev).length > 0 ? prev : undefined,
  });
}
