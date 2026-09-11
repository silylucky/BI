import type { ChartGeo3dStyle, ChartGeoStyle } from "@/lib/chartDeStyle";

export type GeoMapRenderEngine = "three" | "d3-fallback";

export type Geo3dStylePatchInput = {
  geo3dStyle?: ChartGeo3dStyle;
  geoStyle?: ChartGeoStyle;
  isDark?: boolean;
};

export type GeoMapRenderResult = {
  dispose: () => void;
  engine: GeoMapRenderEngine;
  fallbackReason?: string;
  webglApi?: "webgl2" | "webgl" | "none";
  /** 仅更新画布尺寸，避免拖拽缩放时重建 WebGL 场景 */
  resize?: (width: number, height: number) => boolean;
  /** 暂停/恢复 Three rAF（编辑态未选中、屏外） */
  setAnimationActive?: (active: boolean) => void;
  /** 增量更新 geo3d 样式；返回 false 表示需全量重建 */
  patchGeo3dStyle?: (input: Geo3dStylePatchInput) => boolean | Promise<boolean>;
};

export const GEO_MAP_WEBGL_FALLBACK_BANNER =
  "当前环境无法创建 WebGL 上下文，无法渲染 3D 区域地图。请检查浏览器硬件加速或显卡驱动。";

export const GEO_MAP_THREE_INIT_FALLBACK_BANNER =
  "3D 区域地图初始化失败，请刷新页面后重试。";

/** @deprecated 使用 resolveGeoMapFallbackBanner */
export const GEO_MAP_FALLBACK_BANNER = GEO_MAP_WEBGL_FALLBACK_BANNER;

/** @deprecated map-3d 不再降级为 2D；保留枚举兼容旧测试/日志 */
export const GEO_MAP_QUALITY_FALLBACK_BANNER =
  "3D 区域地图当前无法渲染，请稍后重试。";

export const GEO_MAP_WEBGL_CAP_FALLBACK_BANNER =
  "同页 3D 地图实例过多，请减少 3D 地图数量后重试。";

export function resolveGeoMapFallbackBanner(reason?: string): string {
  if (reason === "quality-degraded") {
    return GEO_MAP_QUALITY_FALLBACK_BANNER;
  }
  if (reason === "webgl-cap-exceeded") {
    return GEO_MAP_WEBGL_CAP_FALLBACK_BANNER;
  }
  if (reason === "three-init-failed") {
    return GEO_MAP_THREE_INIT_FALLBACK_BANNER;
  }
  if (reason === "webgl-unavailable") {
    return GEO_MAP_WEBGL_FALLBACK_BANNER;
  }
  return GEO_MAP_WEBGL_FALLBACK_BANNER;
}
