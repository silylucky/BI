import type { ChartRenderPlan } from "@/components/charts/engine/buildChartRenderPlan";
import type { ChartStyleContext } from "@/components/charts/engine/types";
import { resolveD3Theme } from "@/components/charts/engine/d3/core/themeEngine";
import { readChartPieStyle } from "@/lib/chartDeStyle";
import type { ChartType } from "@/lib/chartViewConfig";
import { isPieRoseOnlyChartType, shouldApplyPieInnerRadius } from "@/lib/defaultPieChartDeStyle";

/** D3 渲染计划样式映射（配色、图例开关等） */
export function applyD3Style(
  plan: ChartRenderPlan,
  ctx: ChartStyleContext,
  opts?: { chartType?: ChartType; styleVariant?: string },
): ChartRenderPlan {
  if (plan.kind !== "d3") return plan;
  const options = { ...plan.options };
  const tokens = resolveD3Theme(ctx.scheme, ctx.chartColors[0]);

  if (ctx.chartColors.length > 0) {
    options.color = ctx.chartColors;
  }

  if (plan.plotType === "Pie") {
    const pieStyle = readChartPieStyle(ctx.deStyle);
    if (
      pieStyle.innerRadiusPercent != null &&
      pieStyle.innerRadiusPercent > 0 &&
      shouldApplyPieInnerRadius(opts?.chartType, opts?.styleVariant)
    ) {
      options.innerRadius = pieStyle.innerRadiusPercent / 100;
    } else if (isPieRoseOnlyChartType(opts?.chartType, opts?.styleVariant)) {
      options.innerRadius = 0;
    }
  }

  options.__d3Theme = tokens;
  options.__showLabel = ctx.showLabel;
  options.__showTooltip = ctx.showTooltip;
  options.__labelFontSize = ctx.labelPresentation.fontSize;
  options.__labelColor = ctx.labelPresentation.color;
  options.__seriesGradient = ctx.seriesGradient;
  options.__tooltipPresentation = ctx.tooltipPresentation;
  options.__valueFormat = ctx.valueFormat;
  options.__shellLegend = ctx.shellLegend;
  options.__legendShow = ctx.deStyle.legend?.show !== false;

  if (
    ctx.dataZoom &&
    (plan.plotType === "Line" ||
      plan.plotType === "Column" ||
      plan.plotType === "Bar" ||
      plan.plotType === "DualAxes" ||
      Boolean(options.area))
  ) {
    options.__dataZoom = true;
  }

  return { ...plan, options };
}
