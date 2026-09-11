import { SCREEN_ACCENT } from "@/lib/screenTokens";
import { randomId } from "@/lib/randomId";

/** 流光高亮描边宽度（mask 裁切段，贴可见线） */
export const BORDER_FLOW_GLOW_STROKE_PX = 1;
/** @deprecated 使用 BORDER_FLOW_GLOW_STROKE_PX */
export const BORDER_FLOW_HEAD_DOT_PX = BORDER_FLOW_GLOW_STROKE_PX;
/** 拖影长度默认值（像素） */
export const BORDER_FLOW_TRAIL_LENGTH_DEFAULT_PX = 48;
export const BORDER_FLOW_TRAIL_LENGTH_MIN_PX = 8;
export const BORDER_FLOW_TRAIL_LENGTH_MAX_PX = 120;
/** 拖影光斑半径（viewBox 0–100 坐标，随 SVG 等比缩放） */
export const BORDER_FLOW_TRAIL_MIN_VIEWBOX_UNITS = 4;
export const BORDER_FLOW_TRAIL_MAX_VIEWBOX_UNITS = 18;

export type ScreenBorderSparkleDirection = "cw" | "ccw";

export type ScreenBorderSparkleConfig = {
  id: string;
  color?: string;
  /** @deprecated 大小固定，仅保留字段兼容旧数据 */
  size?: number;
  /** 绕边框一圈的秒数 */
  speed?: number;
  /** @deprecated 拖影始终开启 */
  trailEnabled?: boolean;
  /** 拖影长度（像素） */
  trailLength?: number;
  /** @deprecated 起始位置由序号自动均分 */
  offset?: number;
  /** @deprecated 方向固定顺时针 */
  direction?: ScreenBorderSparkleDirection;
};

export type ScreenBorderSparkleStyleConfig = {
  enabled?: boolean;
  sparkles?: ScreenBorderSparkleConfig[];
};

export const DEFAULT_SCREEN_BORDER_SPARKLE: Required<
  Omit<ScreenBorderSparkleConfig, "id">
> = {
  color: SCREEN_ACCENT,
  size: BORDER_FLOW_HEAD_DOT_PX,
  speed: 4,
  trailEnabled: true,
  trailLength: BORDER_FLOW_TRAIL_LENGTH_DEFAULT_PX,
  offset: 0,
  direction: "cw",
};

export function createScreenBorderSparkle(
  partial?: Partial<ScreenBorderSparkleConfig>,
): ScreenBorderSparkleConfig {
  return {
    id: partial?.id ?? randomId(),
    color: partial?.color ?? DEFAULT_SCREEN_BORDER_SPARKLE.color,
    size: partial?.size ?? DEFAULT_SCREEN_BORDER_SPARKLE.size,
    speed: partial?.speed ?? DEFAULT_SCREEN_BORDER_SPARKLE.speed,
    trailEnabled: partial?.trailEnabled ?? DEFAULT_SCREEN_BORDER_SPARKLE.trailEnabled,
    trailLength: partial?.trailLength ?? DEFAULT_SCREEN_BORDER_SPARKLE.trailLength,
    offset: partial?.offset ?? DEFAULT_SCREEN_BORDER_SPARKLE.offset,
    direction: partial?.direction ?? DEFAULT_SCREEN_BORDER_SPARKLE.direction,
  };
}

export function normalizeScreenBorderSparkle(
  raw?: ScreenBorderSparkleConfig,
): Required<ScreenBorderSparkleConfig> {
  const base = createScreenBorderSparkle(raw);
  return {
    id: base.id,
    color: base.color ?? DEFAULT_SCREEN_BORDER_SPARKLE.color,
    size: BORDER_FLOW_HEAD_DOT_PX,
    speed: clamp(base.speed ?? DEFAULT_SCREEN_BORDER_SPARKLE.speed, 1, 20),
    trailEnabled: true,
    trailLength: clamp(
      base.trailLength ?? BORDER_FLOW_TRAIL_LENGTH_DEFAULT_PX,
      BORDER_FLOW_TRAIL_LENGTH_MIN_PX,
      BORDER_FLOW_TRAIL_LENGTH_MAX_PX,
    ),
    offset: 0,
    direction: "cw",
  };
}

export function normalizeScreenBorderSparkleStyle(
  raw?: ScreenBorderSparkleStyleConfig,
): Required<ScreenBorderSparkleStyleConfig> & {
  sparkles: Required<ScreenBorderSparkleConfig>[];
} {
  const enabled = raw?.enabled ?? false;
  const sparkles = (raw?.sparkles ?? []).map((item) => normalizeScreenBorderSparkle(item));
  const resolvedSparkles =
    sparkles.length > 0
      ? sparkles
      : enabled
        ? [normalizeScreenBorderSparkle(createScreenBorderSparkle())]
        : [];
  return {
    enabled,
    sparkles: resolvedSparkles,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 拖影像素配置 → mask 圆半径（屏幕像素，光斑不随拉伸变椭圆） */
export function trailLengthToMaskRadiusPx(
  trailLengthPx: number,
  boundsMinPx?: number,
): number {
  const clamped = clamp(
    trailLengthPx,
    BORDER_FLOW_TRAIL_LENGTH_MIN_PX,
    BORDER_FLOW_TRAIL_LENGTH_MAX_PX,
  );
  const base = Math.max(6, clamped / 2.2);
  if (boundsMinPx != null && boundsMinPx > 0) {
    return Math.min(base, boundsMinPx * 0.14);
  }
  return base;
}

/** @deprecated 拖影光斑半径（viewBox 0–100）；画布流光请用 trailLengthToMaskRadiusPx */
export function trailLengthToMaskRadius(trailLengthPx: number): number {
  const clamped = clamp(
    trailLengthPx,
    BORDER_FLOW_TRAIL_LENGTH_MIN_PX,
    BORDER_FLOW_TRAIL_LENGTH_MAX_PX,
  );
  const ratio =
    (clamped - BORDER_FLOW_TRAIL_LENGTH_MIN_PX) /
    (BORDER_FLOW_TRAIL_LENGTH_MAX_PX - BORDER_FLOW_TRAIL_LENGTH_MIN_PX);
  return (
    BORDER_FLOW_TRAIL_MIN_VIEWBOX_UNITS +
    ratio * (BORDER_FLOW_TRAIL_MAX_VIEWBOX_UNITS - BORDER_FLOW_TRAIL_MIN_VIEWBOX_UNITS)
  );
}
