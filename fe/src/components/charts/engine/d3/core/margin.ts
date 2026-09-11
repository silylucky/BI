import { scaleAxisLayoutPx } from "@/components/charts/engine/d3/core/chartVisualTokens";

export const CARTESIAN_MARGIN = { top: 24, right: 20, bottom: 52, left: 52 };

type MarginOverrides = Partial<typeof CARTESIAN_MARGIN>;

/** 基础笛卡尔边距；随轴字号放大，避免标签画出绘图区 */
export function cartesianMargin(_showLegend = false, overrides?: MarginOverrides): typeof CARTESIAN_MARGIN {
  return {
    top: scaleAxisLayoutPx(CARTESIAN_MARGIN.top),
    right: scaleAxisLayoutPx(CARTESIAN_MARGIN.right),
    bottom: scaleAxisLayoutPx(CARTESIAN_MARGIN.bottom),
    left: scaleAxisLayoutPx(CARTESIAN_MARGIN.left),
    ...overrides,
  };
}

export const RADIAL_MARGIN = { top: 24, right: 20, bottom: 24, left: 20 };

export function radialMargin(_showLegend = false): typeof RADIAL_MARGIN {
  return { ...RADIAL_MARGIN };
}
