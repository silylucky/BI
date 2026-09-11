import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderD3FunnelChart } from "./renderFunnel";
import { computeFunnelLayout, FUNNEL_PAD, FUNNEL_THUMBNAIL_PAD, funnelLayerTopY } from "./funnelLayout";
import { getAntvThemeTokens } from "@/components/charts/engine/antv/theme";
import { setDepthVisual } from "@/components/charts/engine/d3/core/depthEngine";

const theme = getAntvThemeTokens("light");
const data = [
  { stage: "A", number: 100 },
  { stage: "B", number: 80 },
  { stage: "C", number: 60 },
  { stage: "D", number: 40 },
];

function firstLayerTop(container: HTMLElement): number {
  const d = container.querySelector("path.vs-funnel-layer")?.getAttribute("d") ?? "";
  const match = /M [-\d.]+ ([\d.]+)/.exec(d);
  return Number(match?.[1] ?? NaN);
}

describe("renderD3FunnelChart", () => {
  beforeEach(() => {
    SVGElement.prototype.getBBox = () =>
      ({
        x: 8,
        y: 4,
        width: 280,
        height: 168,
      }) as DOMRect;
  });

  afterEach(() => {
    setDepthVisual("off");
  });

  it("does not reserve legend space when legend is disabled", () => {
    const container = document.createElement("div");
    const cleanup = renderD3FunnelChart(container, {
      width: 180,
      height: 280,
      colors: ["#465fff", "#12b76a", "#f79009"],
      theme,
      showLabel: false,
      showTooltip: false,
      showLegend: false,
      labelFontSize: 11,
      legendLayout: { position: "bottom" },
      options: { data },
    });

    expect(container.querySelector("g.vs-legend")).toBeNull();
    expect(firstLayerTop(container)).toBeCloseTo(FUNNEL_PAD.top, 0);
    cleanup();
  });

  it("places layers with a visible gap", () => {
    const layout = computeFunnelLayout({
      width: 200,
      height: 300,
      count: 4,
      showLegend: false,
      legendItems: [],
      showConversion: false,
      gap: 4,
    });
    expect(funnelLayerTopY(layout, 1) - (funnelLayerTopY(layout, 0) + layout.layerH)).toBe(4);
    expect(layout.margin.top).toBe(FUNNEL_PAD.top);
    expect(layout.margin.bottom).toBe(FUNNEL_PAD.bottom);
  });

  it("uses tighter padding in thumbnail layout", () => {
    const layout = computeFunnelLayout({
      width: 320,
      height: 180,
      count: 5,
      showLegend: false,
      legendItems: [],
      showConversion: false,
      renderTier: "thumbnail",
    });
    expect(layout.margin.top).toBe(FUNNEL_THUMBNAIL_PAD.top);
    expect(layout.gap).toBeLessThanOrEqual(2);
  });

  it("draws isometric top and side faces when depth is on", () => {
    setDepthVisual("standard");
    const container = document.createElement("div");
    const cleanup = renderD3FunnelChart(container, {
      width: 220,
      height: 320,
      colors: ["#465fff", "#12b76a", "#f79009"],
      theme,
      showLabel: false,
      showTooltip: false,
      showLegend: false,
      labelFontSize: 11,
      options: { data },
    });
    expect(container.querySelectorAll("path.vs-funnel-top").length).toBe(data.length);
    expect(container.querySelectorAll("path.vs-funnel-side").length).toBe(data.length);
    expect(container.querySelectorAll("path.vs-funnel-layer").length).toBe(data.length);
    cleanup();
  });

  it("fits funnel inside thumbnail hub cards via viewBox", () => {
    const container = document.createElement("div");
    const stages = [
      { stage: "访问", number: 100 },
      { stage: "注册", number: 80 },
      { stage: "试用", number: 60 },
      { stage: "付费", number: 40 },
      { stage: "续费", number: 20 },
    ];
    const cleanup = renderD3FunnelChart(container, {
      width: 320,
      height: 180,
      colors: ["#465fff", "#12b76a", "#f79009", "#7a5af8", "#06aed4"],
      theme,
      showLabel: false,
      showTooltip: false,
      showLegend: false,
      labelFontSize: 11,
      renderTier: "thumbnail",
      options: { data: stages },
    });

    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("viewBox")).toBe("4 0 288 176");
    expect(svg?.getAttribute("preserveAspectRatio")).toBe("xMidYMid meet");
    expect(container.querySelectorAll("path.vs-funnel-layer").length).toBe(stages.length);
    expect(container.querySelectorAll("path.vs-funnel-top").length).toBe(0);
    cleanup();
  });
});
