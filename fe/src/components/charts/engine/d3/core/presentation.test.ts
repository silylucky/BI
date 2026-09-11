import { describe, expect, it } from "vitest";
import { buildD3PresentationProps, resolveLabelFill } from "./presentation";
import type { ChartStyleContext } from "@/components/charts/engine/types";
import { getAntvThemeTokens } from "@/components/charts/engine/antv/theme";

const baseStyle = (): ChartStyleContext => ({
  scheme: "light",
  deStyle: {},
  deFeatures: {},
  chartColors: ["#465fff"],
  dataScreenSurface: false,
  showLabel: true,
  showTooltip: true,
  seriesGradient: true,
  depthVisual: "standard",
  dataZoom: false,
  labelPresentation: { fontSize: 14, color: "#ff0000" },
  tooltipPresentation: { fontSize: 13, color: "#00ff00", background: "#111111" },
  shellLegend: false,
  embedEdit: false,
});

describe("presentation", () => {
  it("buildD3PresentationProps maps style context fields", () => {
    expect(buildD3PresentationProps(baseStyle())).toEqual({
      labelFontSize: 14,
      labelColor: "#ff0000",
      seriesGradient: true,
      depthVisual: "standard",
      tooltipPresentation: { fontSize: 13, color: "#00ff00", background: "#111111" },
      legendLayout: {
        position: "bottom",
        orient: "horizontal",
        icon: "triangle",
        iconSize: 6,
        hAlign: "center",
        vAlign: "bottom",
      },
    });
  });

  it("resolveLabelFill prefers explicit label color", () => {
    const theme = getAntvThemeTokens("light");
    expect(resolveLabelFill(theme, "#abcdef")).toBe("#abcdef");
    expect(resolveLabelFill(theme, undefined)).toBe(theme.axisLabel);
  });
});
