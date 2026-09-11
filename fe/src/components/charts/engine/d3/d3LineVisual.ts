export * from "@/components/charts/engine/d3/core/chartVisualTokens";
export * from "@/components/charts/engine/d3/core/themeEngine";
export * from "@/components/charts/engine/d3/core/sceneGraph";
export * from "@/components/charts/engine/d3/core/crosshair";
export * from "@/components/charts/engine/d3/core/tooltipLayer";
export * from "@/components/charts/engine/d3/core/motionEngine";
export * from "@/components/charts/engine/d3/core/interactionBus";
export * from "@/components/charts/engine/d3/core/perfRouter";
export * from "@/components/charts/engine/d3/core/incrementalRender";

export type { D3CartesianDatum, D3CartesianRenderConfig, D3LineDatum } from "@/components/charts/engine/d3/types";
export { pickCategoryTicks, styleAxis, applyRotatedCategoryLabels } from "@/components/charts/engine/d3/core/axes";
export { nearestCategory } from "@/components/charts/engine/d3/core/interaction";
export { ensureGradientDef } from "@/components/charts/engine/d3/core/gradient";
export { animateStrokePath, animateBarHeight, prefersReducedMotion, chartTransition } from "@/components/charts/engine/d3/core/animate";
export { buildLineGenerator, buildAreaGenerator } from "@/components/charts/engine/d3/cartesian/geometry";
export {
  groupSeries,
  hasActiveConditionalRules,
  normalizeCartesianData,
  paintConditionalLineSegments,
  resolveDatumColor,
} from "@/components/charts/engine/d3/core/series";
export { createTooltip, tooltipHtml } from "@/components/charts/engine/d3/core/tooltip";
export { cartesianMargin } from "@/components/charts/engine/d3/core/margin";
