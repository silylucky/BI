import type { Geo3dRenderTier } from "@/components/charts/engine/three/geo3dRuntime";
import type { D3LegendPresentation, D3TooltipPresentation } from "@/components/charts/engine/d3/core/presentation";
import {
  resolveScaledAxisFontSize,
  scaleChartPresentationFontSize,
} from "@/components/charts/engine/d3/core/chartPresentationScale";
import { setAxisFontSize } from "@/components/charts/engine/d3/core/chartVisualTokens";

/** 看板/编辑页常规嵌入时的视觉跨度基准 */
export const CHART_PRESENTATION_REFERENCE_SPAN = 320;
/** 列表 Hub 卡片缩略图对标编辑预览区的典型跨度 */
export const CHART_THUMBNAIL_REFERENCE_SPAN = 560;
export const MIN_CHART_PRESENTATION_FONT_SIZE = 6;

export type ChartPresentationPaintContext = {
  chartWidth: number;
  chartHeight: number;
  visualScale?: number;
  renderTier?: Geo3dRenderTier;
};

function safeVisualScale(visualScale?: number): number {
  return visualScale && visualScale > 0 ? visualScale : 1;
}

export function resolveChartPresentationSpan(
  chartWidth: number,
  chartHeight: number,
): number {
  const width = chartWidth > 0 ? chartWidth : CHART_PRESENTATION_REFERENCE_SPAN;
  const height = chartHeight > 0 ? chartHeight : CHART_PRESENTATION_REFERENCE_SPAN;
  return Math.min(width, height);
}

/** 视觉占位相对基准跨度的缩放比（≤1） */
export function resolveChartPresentationVisualScale(
  chartWidth: number,
  chartHeight: number,
  visualScale = 1,
  renderTier?: Geo3dRenderTier,
): number {
  const safeScale = safeVisualScale(visualScale);
  const span = resolveChartPresentationSpan(chartWidth, chartHeight) * safeScale;
  const reference =
    renderTier === "thumbnail" ? CHART_THUMBNAIL_REFERENCE_SPAN : CHART_PRESENTATION_REFERENCE_SPAN;
  const ratio = span / reference;
  const floor = renderTier === "thumbnail" ? 0.14 : 0.35;
  if (span >= reference) return 1;
  return Math.max(floor, ratio);
}

/** 按视觉目标反算 SVG/HTML 绘制坐标系字号（像素画布高分辨率绘制 + CSS 缩小时需放大 paint 字号） */
export function scaleChartPresentationFontSize(
  base: number,
  paint: ChartPresentationPaintContext,
): number {
  const safeScale = safeVisualScale(paint.visualScale);
  const presentationScale = resolveChartPresentationVisualScale(
    paint.chartWidth,
    paint.chartHeight,
    safeScale,
    paint.renderTier,
  );
  const visualTarget =
    presentationScale >= 1
      ? base
      : Math.max(
          MIN_CHART_PRESENTATION_FONT_SIZE,
          Math.round(base * presentationScale),
        );
  return Math.max(
    MIN_CHART_PRESENTATION_FONT_SIZE,
    Math.round(visualTarget / safeScale),
  );
}

export function scaleD3PresentationProps(
  presentation: {
    labelFontSize: number;
    tooltipPresentation?: D3TooltipPresentation;
    legendLayout?: D3LegendPresentation;
  },
  paint: ChartPresentationPaintContext,
) {
  const scale = (size: number) => scaleChartPresentationFontSize(size, paint);
  return {
    ...presentation,
    labelFontSize: scale(presentation.labelFontSize),
    tooltipPresentation: presentation.tooltipPresentation
      ? {
          ...presentation.tooltipPresentation,
          fontSize: scale(presentation.tooltipPresentation.fontSize),
        }
      : presentation.tooltipPresentation,
    legendLayout: presentation.legendLayout
      ? {
          ...presentation.legendLayout,
          fontSize:
            presentation.legendLayout.fontSize != null
              ? scale(presentation.legendLayout.fontSize)
              : undefined,
          iconSize:
            presentation.legendLayout.iconSize != null
              ? scale(presentation.legendLayout.iconSize)
              : undefined,
        }
      : presentation.legendLayout,
  };
}

export function resolveScaledAxisFontSize(paint: ChartPresentationPaintContext, base = 11): number {
  return scaleChartPresentationFontSize(base, paint);
}

export function beginPresentationPaint(paint: ChartPresentationPaintContext): void {
  setAxisFontSize(resolveScaledAxisFontSize(paint));
}

export function endPresentationPaint(): void {
  setAxisFontSize(null);
}

/** Hub 卡片缩略图：仅保留图形轮廓，关闭图例与数据标签避免挤占预览区 */
export function applyHubThumbnailStyleOverrides<
  T extends { showLegend?: boolean; showLabel?: boolean; depthVisual?: import("@/components/charts/engine/d3/core/chartVisualTokens").DepthVisualLevel },
>(style: T, renderTier?: Geo3dRenderTier): T {
  if (renderTier !== "thumbnail") return style;
  return { ...style, showLegend: false, showLabel: false, depthVisual: "off" };
}
