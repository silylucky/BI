import type { AntvThemeTokens } from "@/components/charts/engine/antv/theme";
import type { ChartStyleContext } from "@/components/charts/engine/types";
import { readChartLegendPosition } from "@/lib/chartDeStyle";
import {
  readChartLegendHAlign,
  readChartLegendIcon,
  readChartLegendIconSize,
  readChartLegendOrient,
  readChartLegendVAlign,
} from "@/lib/chartLegendPresentation";

export type D3TooltipPresentation = {
  fontSize: number;
  color?: string;
  background?: string;
};

export type D3LabelPresentation = {
  fontSize: number;
  color?: string;
};

export type D3LegendPresentation = {
  position: "top" | "bottom" | "left" | "right";
  orient: "horizontal" | "vertical";
  icon?: import("@/lib/chartDeStyle").ChartLegendIconShape;
  iconSize?: number;
  fontSize?: number;
  color?: string;
  hAlign?: "left" | "center" | "right";
  vAlign?: "top" | "middle" | "bottom";
};

export function buildD3PresentationProps(style: ChartStyleContext) {
  const deStyle = style.deStyle;
  const legend = deStyle.legend;
  return {
    labelFontSize: style.labelPresentation.fontSize,
    labelColor: style.labelPresentation.color,
    seriesGradient: style.seriesGradient,
    depthVisual: style.depthVisual,
    tooltipPresentation: style.tooltipPresentation,
    legendLayout: {
      position: readChartLegendPosition(deStyle),
      orient: readChartLegendOrient(deStyle),
      icon: readChartLegendIcon(deStyle),
      iconSize: readChartLegendIconSize(deStyle),
      fontSize: legend?.fontSize,
      color: legend?.color,
      hAlign: readChartLegendHAlign(deStyle),
      vAlign: readChartLegendVAlign(deStyle),
    } satisfies D3LegendPresentation,
  };
}

export function resolveLabelFill(theme: AntvThemeTokens, labelColor?: string): string {
  const trimmed = labelColor?.trim();
  if (trimmed) return trimmed;
  return theme.axisLabel;
}
