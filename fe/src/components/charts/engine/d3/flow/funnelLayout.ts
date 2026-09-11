import type { D3LegendItem, D3LegendLayout } from "@/components/charts/engine/d3/core/d3Legend";
import { reserveLegendMargin } from "@/components/charts/engine/d3/core/d3Legend";
import type { Geo3dRenderTier } from "@/components/charts/engine/three/geo3dRuntime";

/** 无坐标轴：贴边绘制，关闭图例时不留空带 */
export const FUNNEL_PAD = { top: 8, right: 8, bottom: 8, left: 8 };

export const FUNNEL_THUMBNAIL_PAD = { top: 4, right: 4, bottom: 4, left: 4 };

export type FunnelLayout = {
  margin: { top: number; right: number; bottom: number; left: number };
  innerW: number;
  innerH: number;
  cx: number;
  maxWidth: number;
  layerH: number;
  gap: number;
  conversionGutter: number;
};

export function computeFunnelLayout(opts: {
  width: number;
  height: number;
  count: number;
  showLegend: boolean;
  legendLayout?: D3LegendLayout;
  legendItems: D3LegendItem[];
  showConversion: boolean;
  gap?: number;
  extrudePx?: number;
  renderTier?: Geo3dRenderTier;
}): FunnelLayout {
  const isThumbnail = opts.renderTier === "thumbnail";
  const extrude = isThumbnail ? 0 : Math.max(0, opts.extrudePx ?? 0);
  const basePad = isThumbnail ? FUNNEL_THUMBNAIL_PAD : FUNNEL_PAD;
  let margin = {
    top: basePad.top + extrude,
    right: basePad.right + (extrude > 0 ? extrude : 0),
    bottom: basePad.bottom,
    left: basePad.left,
  };
  if (opts.showLegend && opts.legendItems.length > 0) {
    margin = reserveLegendMargin(
      margin,
      opts.width,
      opts.height,
      opts.legendLayout,
      opts.legendItems,
    );
  }

  const conversionGutter = opts.showConversion
    ? Math.min(72, Math.max(44, Math.round(opts.width * 0.14)))
    : 0;
  margin = { ...margin, right: margin.right + conversionGutter };

  const innerW = Math.max(0, opts.width - margin.left - margin.right);
  const innerH = Math.max(0, opts.height - margin.top - margin.bottom);
  const gap = isThumbnail
    ? Math.min(2, Math.max(0, opts.gap ?? 2))
    : Math.max(0, opts.gap ?? 4, extrude > 0 ? extrude + 2 : 0);
  const count = Math.max(1, opts.count);
  const layerH = Math.max(8, (innerH - gap * Math.max(0, count - 1)) / count);
  const maxWidth = innerW * (opts.showConversion ? 0.9 : 0.94);

  return {
    margin,
    innerW,
    innerH,
    cx: margin.left + innerW / 2,
    maxWidth,
    layerH,
    gap,
    conversionGutter,
  };
}

export function funnelLayerTopY(layout: FunnelLayout, index: number): number {
  return layout.margin.top + index * (layout.layerH + layout.gap);
}
