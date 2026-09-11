import { describe, expect, it } from "vitest";
import {
  CHART_LEGEND_FONT_SIZE_OPTIONS,
  CHART_LEGEND_ICON_SIZE_OPTIONS,
  readChartLegendHAlign,
  readChartLegendIcon,
  readChartLegendIconSize,
  readChartLegendOrient,
  readChartLegendVAlign,
  resolveEmbeddedLegendOrient,
  resolveLegendPositionFromAlign,
} from "./chartLegendPresentation";

describe("chartLegendPresentation", () => {
  it("defaults icon to triangle and size to 6", () => {
    expect(readChartLegendIcon({})).toBe("triangle");
    expect(readChartLegendIconSize({})).toBe(6);
  });

  it("exposes expanded legend icon and font size presets", () => {
    expect(CHART_LEGEND_ICON_SIZE_OPTIONS.at(-1)).toBe(32);
    expect(CHART_LEGEND_FONT_SIZE_OPTIONS.at(-1)).toBe(48);
    expect(CHART_LEGEND_FONT_SIZE_OPTIONS[0]).toBe(6);
  });

  it("infers vertical orient for left/right position", () => {
    expect(readChartLegendOrient({ legend: { position: "left" } })).toBe("vertical");
    expect(readChartLegendOrient({ legend: { position: "right" } })).toBe("vertical");
    expect(readChartLegendOrient({ legend: { position: "bottom" } })).toBe("horizontal");
  });

  it("respects explicit orient override", () => {
    expect(
      readChartLegendOrient({ legend: { position: "bottom", orient: "vertical" } }),
    ).toBe("vertical");
  });

  it("forces vertical orient for side legend slots", () => {
    expect(resolveEmbeddedLegendOrient("left", "horizontal")).toBe("vertical");
    expect(resolveEmbeddedLegendOrient("right", "horizontal")).toBe("vertical");
    expect(resolveEmbeddedLegendOrient("bottom", "horizontal")).toBe("horizontal");
  });

  it("derives default h/v align from position", () => {
    expect(readChartLegendHAlign({ legend: { position: "left" } })).toBe("left");
    expect(readChartLegendVAlign({ legend: { position: "bottom" } })).toBe("bottom");
    expect(readChartLegendHAlign({})).toBe("center");
  });

  it("maps DE align to shell position", () => {
    expect(resolveLegendPositionFromAlign("center", "bottom")).toBe("bottom");
    expect(resolveLegendPositionFromAlign("left", "middle")).toBe("left");
    expect(resolveLegendPositionFromAlign("right", "middle")).toBe("right");
    expect(resolveLegendPositionFromAlign("center", "top")).toBe("top");
    expect(resolveLegendPositionFromAlign("right", "bottom")).toBe("bottom");
  });
});
