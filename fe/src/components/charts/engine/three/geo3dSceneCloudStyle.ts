import type { ChartGeo3dStyle } from "@/lib/chartDeStyle";

export const DEFAULT_SCENE_CLOUD_DENSITY = 0.7;
export const DEFAULT_SCENE_CLOUD_SPEED = 4;
export const DEFAULT_SCENE_CLOUD_HEIGHT = 1.55;
export const SCENE_CLOUD_SPEED_MAX = 6;

export type ResolvedSceneCloudOptions = {
  density: number;
  speed: number;
  height: number;
};

/** 密度滑块同时驱动：云团数量 + 团内浓淡 */
export const SCENE_CLOUD_CLUSTER_MIN = 4;
export const SCENE_CLOUD_CLUSTER_MAX = 10;
export const SCENE_CLOUD_PUFFS_MIN = 24;
export const SCENE_CLOUD_PUFFS_MAX = 40;

export type CloudVisualProfile = {
  clusterCount: number;
  puffPerCluster: number;
  /** 云团水平散布倍率（相对地图 span） */
  spreadScale: number;
  /** 团内分布盒缩放；越高密度越小 → 贴片更重叠 */
  boundsScale: number;
  /** 贴片体积倍率（相对地图 span） */
  volumeScale: number;
  /** 单贴片不透明度 */
  puffOpacity: number;
  /** concentrate inside 边缘最小体积 */
  smallestVolume: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(min: number, max: number, t: number): number {
  return min + (max - min) * t;
}

/** 将密度 [0.1, 1] 归一化到 [0, 1] */
function densityUnit(density: number): number {
  return clamp((density - 0.1) / 0.9, 0, 1);
}

/** 密度 → 数量（团数/贴片数）+ 浓淡（重叠/透明度/体积） */
export function resolveCloudVisualProfile(density: number): CloudVisualProfile {
  const t = densityUnit(density);
  return {
    clusterCount: Math.round(lerp(SCENE_CLOUD_CLUSTER_MIN, SCENE_CLOUD_CLUSTER_MAX, t)),
    puffPerCluster: Math.round(lerp(SCENE_CLOUD_PUFFS_MIN, SCENE_CLOUD_PUFFS_MAX, t)),
    spreadScale: lerp(2.1, 3.0, t),
    boundsScale: lerp(1.35, 0.42, t),
    volumeScale: lerp(0.38, 0.72, t),
    puffOpacity: lerp(0.28, 0.75, t),
    smallestVolume: lerp(0.2, 0.55, t),
  };
}

export function resolveGeo3dSceneCloudDensity(style: ChartGeo3dStyle): number {
  const raw = style.sceneCloudDensity;
  if (raw == null || !Number.isFinite(raw)) return DEFAULT_SCENE_CLOUD_DENSITY;
  return clamp(raw, 0.1, 1);
}

export function resolveGeo3dSceneCloudSpeed(style: ChartGeo3dStyle): number {
  const raw = style.sceneCloudSpeed;
  if (raw == null || !Number.isFinite(raw)) return DEFAULT_SCENE_CLOUD_SPEED;
  return clamp(raw, 0, SCENE_CLOUD_SPEED_MAX);
}

export function resolveGeo3dSceneCloudHeight(style: ChartGeo3dStyle): number {
  const raw = style.sceneCloudHeight;
  if (raw == null || !Number.isFinite(raw)) return DEFAULT_SCENE_CLOUD_HEIGHT;
  return clamp(raw, 0.2, 2);
}

export function resolveGeo3dSceneCloudOptions(style: ChartGeo3dStyle): ResolvedSceneCloudOptions {
  return {
    density: resolveGeo3dSceneCloudDensity(style),
    speed: resolveGeo3dSceneCloudSpeed(style),
    height: resolveGeo3dSceneCloudHeight(style),
  };
}
