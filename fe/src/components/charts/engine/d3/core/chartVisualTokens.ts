/** VCDS 视觉 Token 真理源 */
export const VCDS = {
  line: { width: 2.5, cap: "round" as const, join: "round" as const },
  bar: { rx: 4, stackGap: 1, hoverBrightness: 1.08 },
  pie: { padAngle: 0.015, hoverOffset: 6, strokeWidth: 1.5 },
  grid: { dash: "4 4", opacity: 0.9 },
  axis: { fontSize: 11, rotateThreshold: 72, rotateDeg: -32 },
  dot: { radius: 3, activeRadius: 5.5, strokeWidth: 1.5 },
  crosshair: { dash: "4 4", opacity: 0.85 },
  motion: {
    enter: 720,
    hover: 120,
    crosshair: 200,
    dataUpdate: 480,
    stagger: 40,
  },
  perf: {
    svgFullMaxPoints: 500,
    svgSampleMaxPoints: 5000,
    canvasMinPoints: 5000,
    tableVirtualScrollThreshold: 200,
  },
  tooltip: {
    padding: "10px 12px",
    borderRadius: 8,
    fontSize: 12,
    maxWidth: 240,
  },
  depth: {
    extrudePx: { standard: 6, enhanced: 10 },
    sideDarken: 0.28,
    topLighten: 0.18,
    shadowBlur: { standard: 3, enhanced: 6 },
    pieExtrudeOffset: { standard: 3, enhanced: 6 },
    hoverLiftPx: { standard: 1, enhanced: 2 },
  },
} as const;

export type MotionIntensity = "off" | "standard" | "enhanced";
export type DepthVisualLevel = "off" | "standard" | "enhanced";

let motionIntensity: MotionIntensity = "standard";
let depthVisual: DepthVisualLevel = "off";

export function setMotionIntensity(level: MotionIntensity): void {
  motionIntensity = level;
}

export function getMotionIntensity(): MotionIntensity {
  return motionIntensity;
}

export function setDepthVisual(level: DepthVisualLevel): void {
  depthVisual = level;
}

export function getDepthVisual(): DepthVisualLevel {
  return depthVisual;
}

let axisFontSizeOverride: number | null = null;

/** 缩略图/小尺寸绘制时临时覆盖轴标签字号（对标 setDepthVisual） */
export function setAxisFontSize(px: number | null): void {
  axisFontSizeOverride = px;
}

export function resolveAxisFontSize(): number {
  return axisFontSizeOverride ?? VCDS.axis.fontSize;
}

/** 轴标签绘制字号相对 11px 基准的布局缩放（高分辨率 paint / 放大组件时边距与抽稀必须同步） */
export function axisLayoutScale(): number {
  return resolveAxisFontSize() / VCDS.axis.fontSize;
}

export function scaleAxisLayoutPx(basePx: number): number {
  return Math.max(1, Math.round(basePx * axisLayoutScale()));
}

export function motionDuration(kind: keyof typeof VCDS.motion): number {
  if (motionIntensity === "off") return 0;
  const base = VCDS.motion[kind];
  return motionIntensity === "enhanced" ? Math.round(base * 1.15) : base;
}
