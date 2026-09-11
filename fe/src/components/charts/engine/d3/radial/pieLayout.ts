import type { D3LegendItem, D3LegendLayout } from "@/components/charts/engine/d3/core/d3Legend";
import { reserveLegendMargin } from "@/components/charts/engine/d3/core/d3Legend";
import { pieOutsideLabelExtentFromCenter } from "./pieLabels";

/** 饼图默认外半径占可用半径比例（对标 DE 饼图贴边感） */
export const PIE_RADIUS_FRAC_DEFAULT = 0.92;

const PIE_PAD = { top: 8, right: 8, bottom: 8, left: 8 };

export type PieOutsideLabelFit = {
  maxTextWidth: number;
  fontSize: number;
  radiusFrac: number;
};

/** 外标签会超出扇区：按最长文案把半径压进画布左右边，避免被 overflow:hidden 裁字 */
export function capPieRadiusForOutsideLabels(
  maxR: number,
  cx: number,
  canvasWidth: number,
  fit: PieOutsideLabelFit,
): number {
  const horiz = Math.min(cx, canvasWidth - cx) - 4;
  if (!(maxR > 0) || horiz <= 16) return Math.max(8, Math.min(maxR, 16));
  const frac = Math.min(1, Math.max(0.2, fit.radiusFrac));
  let lo = 8;
  let hi = maxR;
  let best = 8;
  for (let i = 0; i < 24; i += 1) {
    const mid = (lo + hi) / 2;
    const extent = pieOutsideLabelExtentFromCenter(mid * frac, fit.fontSize, fit.maxTextWidth);
    if (extent <= horiz) {
      best = mid;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return Math.min(maxR, best);
}

export type PieLayout = {
  margin: { top: number; right: number; bottom: number; left: number };
  cx: number;
  cy: number;
  maxR: number;
  legendMode: "none" | "inline" | "right";
  legendBox?: { x: number; y: number; w: number; h: number };
};

/** 宽扁组件：图例放右侧；否则内联图例由 reserveLegendMargin 预留边距 */
export function computePieLayout(
  width: number,
  height: number,
  showLegend: boolean,
  legendLayout?: D3LegendLayout,
  legendItems: D3LegendItem[] = [],
  outsideLabels = false,
  outsideLabelFit?: PieOutsideLabelFit,
): PieLayout {
  const base = { ...PIE_PAD };
  const position = legendLayout?.position ?? "bottom";
  const innerW0 = Math.max(0, width - base.left - base.right);
  const innerH0 = Math.max(0, height - base.top - base.bottom);
  const wide = innerW0 > innerH0 * 1.35;
  const useSideLegend = showLegend && wide;
  const sidePosition = position === "left" ? "left" : "right";

  if (useSideLegend) {
    const legendW = Math.min(112, Math.max(76, innerW0 * 0.28));
    const gap = 6;
    const pieW = innerW0 - legendW - gap;
    const maxR = Math.min(pieW, innerH0) / 2;
    const margin = {
      ...base,
      [sidePosition]: base[sidePosition] + legendW + gap,
    };
    const cx =
      sidePosition === "left"
        ? margin.left + pieW / 2
        : base.left + pieW / 2;
    const cy = base.top + innerH0 / 2;
    const legendX = sidePosition === "left" ? base.left : base.left + pieW + gap;
    const fittedR =
      outsideLabels && outsideLabelFit
        ? capPieRadiusForOutsideLabels(maxR, cx, width, outsideLabelFit)
        : maxR;
    return {
      margin,
      cx,
      cy,
      maxR: fittedR,
      legendMode: "right",
      legendBox: { x: legendX, y: base.top, w: legendW, h: innerH0 },
    };
  }

  let margin = base;
  if (showLegend) {
    margin = reserveLegendMargin(margin, width, height, legendLayout, legendItems);
  }
  const innerW = Math.max(0, width - margin.left - margin.right);
  const innerH = Math.max(0, height - margin.top - margin.bottom);
  const cx = margin.left + innerW / 2;
  const cy = margin.top + innerH / 2;
  let maxR = Math.min(innerW, innerH) / 2;
  if (outsideLabels && outsideLabelFit) {
    maxR = capPieRadiusForOutsideLabels(maxR, cx, width, outsideLabelFit);
  }

  return {
    margin,
    cx,
    cy,
    maxR,
    legendMode: showLegend ? "inline" : "none",
  };
}
