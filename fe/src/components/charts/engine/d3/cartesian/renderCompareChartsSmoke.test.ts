import { describe, expect, it } from "vitest";
import { getAntvThemeTokens } from "@/components/charts/engine/antv/theme";
import { renderD3BidirectionalBarChart } from "./renderBidirectionalBar";
import { renderD3BarRangeChart } from "./renderBarRange";
import { renderD3BulletChart } from "./renderBullet";
import { renderD3ProgressBarChart } from "./renderProgressBar";
import { renderD3StockChart } from "./renderStock";
import { renderD3WaterfallChart } from "./renderWaterfall";

const theme = getAntvThemeTokens("light");
const size = { width: 400, height: 240 };

describe("compare chart render smoke", () => {
  it("waterfall renders with legend", () => {
    const host = document.createElement("div");
    const cleanup = renderD3WaterfallChart(host, {
      ...size,
      data: [
        { type: "A", value: 10 },
        { type: "B", value: -5 },
        { type: "C", value: 8 },
      ],
      colors: ["#465fff", "#f04438"],
      theme,
      showLegend: true,
      showLabel: false,
      showTooltip: false,
    });
    expect(host.querySelector("svg")).toBeTruthy();
    cleanup();
  });

  it("bidirectional bar renders with legend", () => {
    const host = document.createElement("div");
    const cleanup = renderD3BidirectionalBarChart(host, {
      ...size,
      data: [
        { type: "甲", left: 12, right: 8 },
        { type: "乙", left: 6, right: 14 },
      ],
      colors: ["#465fff", "#12b76a"],
      theme,
      showLegend: true,
      showLabel: false,
      showTooltip: false,
    });
    expect(host.querySelector("svg")).toBeTruthy();
    expect(host.querySelector("g.vs-legend")).toBeTruthy();
    cleanup();
  });

  it("bidirectional bar omits inline legend when showLegend is false", () => {
    const host = document.createElement("div");
    const cleanup = renderD3BidirectionalBarChart(host, {
      ...size,
      data: [
        { type: "甲", left: 12, right: 8 },
        { type: "乙", left: 6, right: 14 },
      ],
      colors: ["#465fff", "#12b76a"],
      theme,
      showLegend: false,
      showLabel: false,
      showTooltip: false,
    });
    expect(host.querySelector("g.vs-legend")).toBeNull();
    cleanup();
  });

  it("bidirectional bar draws center categories and dual value axes", () => {
    const host = document.createElement("div");
    const cleanup = renderD3BidirectionalBarChart(host, {
      ...size,
      data: [{ type: "A", left: 80, right: 50000 }],
      colors: ["#465fff", "#12b76a"],
      theme,
      showLegend: false,
      showLabel: false,
      showTooltip: false,
    });
    expect(host.querySelector("g.vs-axis-y-center text")).toBeTruthy();
    expect(host.querySelectorAll("g.left-bar rect").length).toBe(1);
    expect(host.querySelectorAll("g.right-bar rect").length).toBe(1);
    expect(host.querySelector("g.vs-axis-x-left")).toBeTruthy();
    expect(host.querySelector("g.vs-axis-x-right")).toBeTruthy();
    const leftX = Number(host.querySelector("g.left-bar rect")?.getAttribute("x") ?? 999);
    expect(leftX).toBeLessThan(40);
    cleanup();
  });

  it("stock chart renders", () => {
    const host = document.createElement("div");
    const cleanup = renderD3StockChart(host, {
      ...size,
      data: [{ type: "D1", open: 10, close: 14, high: 16, low: 8 }],
      colors: ["#12b76a", "#f04438"],
      theme,
      showLabel: false,
      showTooltip: false,
    });
    expect(host.querySelector("rect.candle")).toBeTruthy();
    cleanup();
  });

  it("bullet chart renders", () => {
    const host = document.createElement("div");
    const cleanup = renderD3BulletChart(host, {
      width: 400,
      height: 120,
      data: [{ type: "KPI", actual: 72, target: 80, rangeMax: 100 }],
      colors: ["#465fff", "#12b76a", "#e4e7ec", "#d0d5dd", "#98a2b3"],
      theme,
      showLabel: false,
      showTooltip: false,
    });
    expect(host.querySelector("svg")).toBeTruthy();
    cleanup();
  });

  it("progress bar renders", () => {
    const host = document.createElement("div");
    const cleanup = renderD3ProgressBarChart(host, {
      width: 400,
      height: 120,
      data: [{ type: "完成率", value: 65, max: 100 }],
      colors: ["#465fff"],
      theme,
      showLabel: false,
      showTooltip: false,
    });
    expect(host.querySelector("svg")).toBeTruthy();
    cleanup();
  });

  it("bar range renders", () => {
    const host = document.createElement("div");
    const cleanup = renderD3BarRangeChart(host, {
      width: 400,
      height: 120,
      data: [{ type: "区间", low: 10, high: 28 }],
      colors: ["#465fff"],
      theme,
      showLabel: false,
      showTooltip: false,
    });
    expect(host.querySelector("svg")).toBeTruthy();
    cleanup();
  });
});
