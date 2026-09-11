import * as d3 from "d3";
import { describe, expect, it } from "vitest";
import { setChartAnimationSuppressed } from "@/components/charts/engine/d3/core/animate";
import {
  paintVerticalBar,
  drawExtrudedHorizontalBar,
  resolveEffectiveDepth,
  setDepthVisual,
  shadeColor,
} from "./depthEngine";

describe("shadeColor", () => {
  it("lightens / darkens hex channels in 0–255 space (not clamped to 0–1)", () => {
    expect(shadeColor("#808080", "top")).toBe("rgb(151, 151, 151)");
    expect(shadeColor("#808080", "side")).toBe("rgb(92, 92, 92)");
    expect(shadeColor("#808080", "shadow")).toBe("rgb(80, 80, 80)");
    // 回归：曾误用 clamp01 把 0–255 压成 rgb(1,1,1)
    expect(shadeColor("#465fff", "top")).not.toBe("rgb(1, 1, 1)");
    expect(shadeColor("#465fff", "shadow")).not.toBe("rgb(1, 1, 1)");
  });

  it("returns original color for non-hex input", () => {
    expect(shadeColor("rgb(128,128,128)", "top")).toBe("rgb(128,128,128)");
  });
});

describe("resolveEffectiveDepth", () => {
  it("honors explicit off even when global depth is enhanced", () => {
    setDepthVisual("enhanced");
    expect(resolveEffectiveDepth("off")).toBe("off");
    setDepthVisual("off");
  });

  it("does not disable depth when chart animation is suppressed", () => {
    setDepthVisual("standard");
    setChartAnimationSuppressed(true);
    expect(resolveEffectiveDepth()).toBe("standard");
    setChartAnimationSuppressed(false);
    setDepthVisual("off");
  });
});

describe("paintVerticalBar", () => {
  it("does not throw when depth is off", () => {
    const host = document.createElement("div");
    const svg = d3.select(host).append("svg");
    const plot = svg.append("g");
    expect(() =>
      paintVerticalBar({
        plot,
        x: 0,
        y1: 10,
        height: 24,
        width: 12,
        color: "#465fff",
        depthLevel: "off",
        animate: false,
      }),
    ).not.toThrow();
  });
});

describe("drawExtrudedHorizontalBar", () => {
  it("does not extend bar length on top face (value axis is horizontal)", () => {
    const host = document.createElement("div");
    const svg = d3.select(host).append("svg");
    const plot = svg.append("g");
    setDepthVisual("enhanced");
    drawExtrudedHorizontalBar({
      plot,
      x: 10,
      y: 20,
      width: 80,
      height: 16,
      color: "#465fff",
    });
    const top = plot.select(".vs-hbar-top").attr("d") ?? "";
    expect(top).toContain("90 20");
    expect(top).not.toContain("100 20");
    setDepthVisual("off");
  });
});
