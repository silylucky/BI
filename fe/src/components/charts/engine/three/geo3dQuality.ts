import { GEO3D_THREE_MIN_SHORT_SIDE, type Geo3dRenderTier } from "./geo3dRuntime";

/** 列表卡片缩略图允许更低短边仍尝试 3D（否则过早 2D 且易与测量竞态） */
export const GEO3D_THUMBNAIL_MIN_SHORT_SIDE = 96;

export type Geo3dQualityLevel = "high" | "medium" | "low";

export type Geo3dQualitySetting = "auto" | Geo3dQualityLevel;

/** feature 数超过此值时 auto 模式降为 medium（不再回退 2D） */
export const GEO3D_FEATURE_DEGRADE_THRESHOLD = 80;

/** 短边低于此像素时 auto 模式不用 high */
export const GEO3D_HIGH_MIN_SHORT_SIDE = 320;

/**
 * 缩略图与真实大屏走同一套判定；并发由 WebGL 槽位驱逐兜底，不再回退 2D。
 */
export type ResolveGeo3dQualityInput = {
  quality?: Geo3dQualitySetting;
  drillDepth: number;
  featureCount: number;
  shortSide: number;
  renderTier?: Geo3dRenderTier;
};

export function resolveGeo3dQuality(input: ResolveGeo3dQualityInput): Geo3dQualityLevel {
  const forced = input.quality;
  if (forced && forced !== "auto") {
    return forced;
  }
  if (input.drillDepth >= 2 || input.featureCount > GEO3D_FEATURE_DEGRADE_THRESHOLD) {
    return "low";
  }
  const minShortSide =
    input.renderTier === "thumbnail" ? GEO3D_THUMBNAIL_MIN_SHORT_SIDE : GEO3D_THREE_MIN_SHORT_SIDE;
  if (input.shortSide < minShortSide) {
    return "low";
  }
  if (input.drillDepth >= 1 || input.shortSide < GEO3D_HIGH_MIN_SHORT_SIDE) {
    return "medium";
  }
  return "high";
}
