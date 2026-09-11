import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/** 像素画布缩放后，操作条按钮屏幕边长（px） */
export const PIXEL_SCREEN_ACTION_RAIL_BTN_PX = 36;

/** 像素画布缩放后，操作条图标屏幕边长（px） */
export const PIXEL_SCREEN_ACTION_RAIL_ICON_PX = 18;

/** 像素画布缩放后，屏幕上目标可读高度（px），对齐 text-theme-sm 行高密度 */
export const PIXEL_SCREEN_RAIL_HEIGHT_PX = 32;

/** 预览态 shape 壳层标题栏屏幕高度（px）— 默认 16px 字号 + 行高 + 间隙 */
export const PIXEL_SCREEN_TITLE_HEIGHT_PX = 36;

/** 无配置字号时的设计稿标题字号（px），对齐 --dw-screen-body */
export const DEFAULT_WIDGET_TITLE_FONT_PX = 16;

/** 标题与内容区固定间隙（不随字号变化） */
export const WIDGET_TITLE_CONTENT_GAP_PX = 2;

/** 标题上方内边距 = 字号 × 比例（仅顶边随字号缩放） */
export const WIDGET_TITLE_TOP_PAD_RATIO = 0.25;

/** 默认标题行高倍率，对齐 shape-title 1.375rem line-height */
export const WIDGET_TITLE_LINE_HEIGHT_RATIO = 1.375;

export function scaledChromeLength(px: number, canvasScale = 1): string {
  const scale = canvasScale > 0 ? canvasScale : 1;
  return `calc(${px}px / var(--pixel-canvas-chrome-scale, ${scale}))`;
}

export type WidgetTitleChromeMetrics = {
  fontSizePx: number;
  lineHeightPx: number;
  topPadPx: number;
  gapPx: number;
  /** 标题区占用高度：顶边距 + 行高 + 固定下间隙 */
  blockHeightPx: number;
};

export function resolveWidgetTitleTopPadPx(titleStyle: CSSProperties = {}): number {
  const fontSizePx = resolveWidgetTitleFontSizePx(titleStyle);
  return Math.max(0, Math.round(fontSizePx * WIDGET_TITLE_TOP_PAD_RATIO));
}

export function resolveWidgetTitleFontSizePx(titleStyle: CSSProperties = {}): number {
  return parseCssPx(titleStyle.fontSize) ?? DEFAULT_WIDGET_TITLE_FONT_PX;
}

export function resolveWidgetTitleLineHeightPx(
  titleStyle: CSSProperties,
  fontSizePx: number,
): number {
  const explicit = parseCssPx(titleStyle.lineHeight);
  if (explicit != null) return explicit;
  if (typeof titleStyle.lineHeight === "number") {
    return Math.round(fontSizePx * titleStyle.lineHeight);
  }
  return Math.round(fontSizePx * WIDGET_TITLE_LINE_HEIGHT_RATIO);
}

export function resolveWidgetTitleChromeMetrics(
  titleStyle: CSSProperties = {},
): WidgetTitleChromeMetrics {
  const fontSizePx = resolveWidgetTitleFontSizePx(titleStyle);
  const lineHeightPx = resolveWidgetTitleLineHeightPx(titleStyle, fontSizePx);
  const topPadPx = resolveWidgetTitleTopPadPx(titleStyle);
  const gapPx = WIDGET_TITLE_CONTENT_GAP_PX;
  return {
    fontSizePx,
    lineHeightPx,
    topPadPx,
    gapPx,
    blockHeightPx: topPadPx + lineHeightPx + gapPx,
  };
}

/** shape-title 行高（内联，覆盖 CSS 固定值） */
export function shapeTitleChromeStyle(
  titleStyle: CSSProperties,
  canvasScale = 1,
): CSSProperties {
  const metrics = resolveWidgetTitleChromeMetrics(titleStyle);
  return {
    minHeight: scaledChromeLength(metrics.lineHeightPx, canvasScale),
    paddingTop: 0,
    paddingBottom: 0,
    margin: 0,
  };
}

/** 标题区与图表内容区之间的 flex gap（固定，不随字号变化） */
export function shapeTitleStackStyle(_titleStyle?: CSSProperties, canvasScale = 1): CSSProperties {
  return { gap: scaledChromeLength(WIDGET_TITLE_CONTENT_GAP_PX, canvasScale) };
}

/** pixel-shape-inner：仅顶边距随标题字号缩放 */
export function shapeInnerShellChromeStyle(
  titleStyle: CSSProperties,
  canvasScale = 1,
): CSSProperties {
  return {
    paddingTop: scaledChromeLength(resolveWidgetTitleTopPadPx(titleStyle), canvasScale),
  };
}

export function shapeRemarkChromeStyle(
  titleStyle: CSSProperties,
  canvasScale = 1,
): CSSProperties {
  const fontSizePx = resolveWidgetTitleFontSizePx(titleStyle);
  const remarkGapPx = Math.max(3, Math.round(fontSizePx * 0.375));
  return { paddingBottom: scaledChromeLength(remarkGapPx, canvasScale) };
}

/**
 * 壳层（标题字号、标题栏高度、页签字号）的补偿基数，与 CSS
 * `--pixel-canvas-chrome-scale` 同一套语义：
 * - 编辑态反比补偿，缩小画布时标题与操作条仍可读可点；
 * - 浏览/预览/播放/缩略图一律返回 1，壳层随内容等比缩小，保证 WYSIWYG。
 */
export function resolveShapeTitleCanvasScale(
  canvasScale: number,
  designViewportLocked: boolean,
  mode: "edit" | "view" = "view",
): number {
  if (mode !== "edit" || designViewportLocked) return 1;
  return canvasScale > 0 ? canvasScale : 1;
}

/** 像素画布拖动手柄逻辑高度（随 scale 反比放大，保证缩放后屏幕高度稳定） */
export function pixelDragRailHeightPx(canvasScale: number): number {
  const scale = canvasScale > 0 ? canvasScale : 1;
  return Math.ceil(PIXEL_SCREEN_RAIL_HEIGHT_PX / scale);
}

export function pixelViewTitleHeightPx(
  canvasScale: number,
  titleStyle: CSSProperties = {},
): number {
  const scale = canvasScale > 0 ? canvasScale : 1;
  const metrics = resolveWidgetTitleChromeMetrics(titleStyle);
  return Math.ceil(metrics.blockHeightPx / scale);
}

/** 画布内组件状态/空态文案 */
export const dwState =
  "text-base leading-snug text-[var(--dashboard-state-text,#667085)]";
export const dwStateWarning =
  "text-base leading-snug text-warning-600 dark:text-warning-400";
export const dwStateError =
  "text-base leading-snug text-error-700 dark:text-error-400";

export const dwTitle =
  "text-theme-sm font-semibold leading-snug text-[var(--dashboard-title-color,#1d2939)] dark:text-white/90";

/** 像素画布 shape 顶栏标题（默认字号由 CSS 补偿；有配置时走 shapeTitlePresentationStyle） */
export const dwShapeTitle = cn(dwTitle, "min-w-0 flex-1 truncate");

function parseCssPx(value: string | number | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const matched = String(value).trim().match(/^([\d.]+)px$/);
  return matched ? Number(matched[1]) : null;
}

/** 像素画布标题：保留 DE 配置字号/字距，并按 canvas scale 反比补偿屏幕观感 */
export function shapeTitlePresentationStyle(
  style: CSSProperties,
  canvasScale = 1,
): CSSProperties {
  const scale = canvasScale > 0 ? canvasScale : 1;
  const { fontSize, lineHeight, letterSpacing, ...rest } = style;
  const out: CSSProperties = { ...rest };

  const fontPx = parseCssPx(fontSize);
  if (fontPx != null) {
    out.fontSize = `${fontPx / scale}px`;
    const linePx = parseCssPx(lineHeight);
    out.lineHeight = linePx != null ? `${linePx / scale}px` : 1.25;
  }
  const letterPx = parseCssPx(letterSpacing);
  if (letterPx != null) out.letterSpacing = `${letterPx / scale}px`;

  return out;
}
export const dwCaption =
  "text-sm leading-snug text-[var(--dashboard-text-muted,#667085)]";

/** 图表/地图底部提示、待配置说明等辅助文案 */
export const dwHint =
  "text-sm leading-snug text-[var(--dashboard-text-muted,#667085)]";

/** 看板内嵌表格单元格（对标 DE 行高与密度） */
export const dwTableCell = "px-3 py-2 text-theme-sm tabular-nums";

/** 表格分页、页码等元信息 */
export const dwTableMeta =
  "text-theme-sm tabular-nums text-[var(--dashboard-text-muted,#667085)]";

/** 分页栏内文案：继承容器 paginationFg / paginationFontSize，勿用 dwTableMeta */
export const dwTablePaginationText = "tabular-nums text-inherit";

export const dwMeta = "text-sm tabular-nums text-[var(--dashboard-text-muted,#667085)]";

/** @deprecated 使用 pixelDragRailHeightPx(canvasScale) */
export const PIXEL_DRAG_RAIL_HEIGHT_PX = 40;
