import * as THREE from "three";

/** 光柱/光环相对「整图归一化宽度」的占比（与下钻层级、区域数量无关） */
export const POINT_EFFECT_TO_MAP_RATIO = 0.058;

export type OrbitLayoutSpan = {
  halfX: number;
  halfZ: number;
};

export type PointEffectSizing = {
  /** mapGroup 本地坐标下的特效尺度（用于构建几何体） */
  effectUnit: number;
  /** 布局归一化后的整图视觉宽度（世界空间，通常 ≈18） */
  visualMapSpan: number;
  mapScale: number;
};

/** layoutThreeGeoMapGroup 后的整图视觉跨度（各下钻层级应基本一致） */
export function resolveNormalizedMapVisualSpan(layout: OrbitLayoutSpan): number {
  return Math.max(layout.halfX, layout.halfZ, 4) * 2;
}

export function resolveMapGroupUniformScale(mapGroup: THREE.Group): number {
  const { scale } = mapGroup;
  return Math.max(scale.x, scale.y, scale.z, 1e-6);
}

/**
 * 点位特效尺度：锚定 orbit 布局归一化后的整图宽度，而非单块区域 mesh 尺寸。
 * 下钻后区域在屏幕上变大，但 layout.halfX 基本恒定，可避免「越下钻越大」。
 */
export function resolvePointEffectSizing(
  mapGroup: THREE.Group,
  layout: OrbitLayoutSpan,
): PointEffectSizing {
  const visualMapSpan = resolveNormalizedMapVisualSpan(layout);
  const mapScale = resolveMapGroupUniformScale(mapGroup);
  const visualEffectUnit = visualMapSpan * POINT_EFFECT_TO_MAP_RATIO;
  return {
    effectUnit: visualEffectUnit / mapScale,
    visualMapSpan,
    mapScale,
  };
}
