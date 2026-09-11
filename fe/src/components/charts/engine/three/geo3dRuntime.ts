import type { ChartGeo3dStyle } from "@/lib/chartDeStyle";
import { resolveGeo3dStylePreset } from "./geo3dVisualStyle";

/** full=全屏预览；embed=看板/大屏内嵌；thumbnail=列表卡片等小尺寸预览 */
export type Geo3dRenderTier = "full" | "embed" | "thumbnail";

/** 短边低于此像素时 auto 模式不用 high（仍渲染 3D） */
export const GEO3D_THREE_MIN_SHORT_SIDE = 400;

/** 同页允许同时存在的 WebGL 3D 地图实例上限 */
export const GEO3D_MAX_WEBGL_INSTANCES = 4;

const activeWebglSlots = new Map<string, () => void>();

/** 抢占最旧实例槽位；返回 false 仅当驱逐后仍无法分配 */
export function tryAcquireWebGLSlot(
  instanceKey: string,
  options?: { evictOldest?: boolean },
): boolean {
  if (activeWebglSlots.has(instanceKey)) {
    return true;
  }
  if (activeWebglSlots.size >= GEO3D_MAX_WEBGL_INSTANCES) {
    if (options?.evictOldest && activeWebglSlots.size > 0) {
      const oldestKey = activeWebglSlots.keys().next().value as string;
      const dispose = activeWebglSlots.get(oldestKey);
      dispose?.();
      activeWebglSlots.delete(oldestKey);
    } else {
      return false;
    }
  }
  activeWebglSlots.set(instanceKey, () => undefined);
  return true;
}

export function setWebGLSlotDispose(instanceKey: string, dispose: () => void): void {
  if (activeWebglSlots.has(instanceKey)) {
    activeWebglSlots.set(instanceKey, dispose);
  }
}

export function releaseWebGLSlot(instanceKey: string): void {
  activeWebglSlots.delete(instanceKey);
}

/** 仅当 dispose 仍是槽位当前持有者时释放，避免过期异步渲染误伤新实例 */
export function releaseWebGLSlotIfCurrent(instanceKey: string, dispose: () => void): void {
  if (activeWebglSlots.get(instanceKey) === dispose) {
    activeWebglSlots.delete(instanceKey);
  }
}

/** @internal vitest 专用：清空槽位表 */
export function resetWebGLSlotsForTests(): void {
  activeWebglSlots.clear();
}

/**
 * 仅「卫星实景」预设可启用离线卫星贴图。缩略图同样加载，
 * 否则列表卡片会渲染出无贴图的白色地块，与真实大屏观感割裂。
 */
export function resolveTerrainTextureEnabled(
  _tier: Geo3dRenderTier,
  geo3dStyle: ChartGeo3dStyle,
): boolean {
  if (resolveGeo3dStylePreset(geo3dStyle) !== "satellite") return false;
  return geo3dStyle.terrainTexture !== false;
}

export function defaultGeo3dRenderTier(embedded: boolean): Geo3dRenderTier {
  return embedded ? "embed" : "full";
}
