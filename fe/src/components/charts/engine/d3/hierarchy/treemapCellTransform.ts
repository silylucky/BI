import { VCDS } from "@/components/charts/engine/d3/core/chartVisualTokens";

export const TREEMAP_HOVER_SCALE = 1.05;

export function treemapCellBaseTransform(x0: number, y0: number): string {
  return `translate(${x0},${y0})`;
}

/** 以单元格中心缩放，对标饼图扇区 hover 外扩 */
export function treemapCellHoverTransform(
  x0: number,
  y0: number,
  width: number,
  height: number,
  scale = TREEMAP_HOVER_SCALE,
): string {
  const cx = width / 2;
  const cy = height / 2;
  return `${treemapCellBaseTransform(x0, y0)} translate(${cx},${cy}) scale(${scale}) translate(${-cx},${-cy})`;
}

export const TREEMAP_CELL_STROKE_WIDTH = VCDS.pie.strokeWidth;
export const TREEMAP_CELL_HOVER_STROKE_WIDTH = TREEMAP_CELL_STROKE_WIDTH + 0.5;
