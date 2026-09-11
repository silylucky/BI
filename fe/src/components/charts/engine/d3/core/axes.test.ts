import { afterEach, describe, expect, it } from "vitest";
import {
  estimateAxisLabelWidth,
  estimateAxisLabelTextWidth,
  formatAxisCategoryLabel,
  formatHorizontalBandAxisLabel,
  estimateCategoryBandCenterPx,
  drawCategoryBandAxisBottom,
  pickCategoryTickIndices,
  pickCategoryTickIndicesByPixel,
  pickCategoryTickIndicesForLabels,
  pickCategoryTicks,
  pickUniformOverlapAwareTickIndices,
  planCategoryAxisLayout,
  resolveBandAxisFontSize,
  resolveCategoryLabelRotate,
  resolveHorizontalCategoryAxisLayout,
  resolveNumericTickCount,
  planNumericAxisTicks,
  distinctFormattedNumericTickValues,
  valueAxisUpperBound,
} from "@/components/charts/engine/d3/core/axes";
import { nearestCategory } from "@/components/charts/engine/d3/core/interaction";
import { setAxisFontSize } from "@/components/charts/engine/d3/core/chartVisualTokens";
import { cartesianMargin } from "@/components/charts/engine/d3/core/margin";
import * as d3 from "d3";

describe("d3 core", () => {
  afterEach(() => {
    setAxisFontSize(null);
  });
  it("pickCategoryTickIndices uses a constant index step", () => {
    const indices = pickCategoryTickIndices(24, 480, 72);
    expect(indices[0]).toBe(0);
    expect(indices.length).toBeGreaterThan(2);
    const gaps = indices.slice(1).map((value, i) => value - indices[i]!);
    gaps.forEach((gap) => expect(gap).toBe(gaps[0]));
  });

  it("pickCategoryTickIndicesByPixel uses the same constant index step", () => {
    const count = 40;
    const innerW = 800;
    const step = innerW / count;
    const bw = step * 0.8;
    const indexToPx = (i: number) => estimateCategoryBandCenterPx(i, count, innerW, bw);
    const indices = pickCategoryTickIndicesByPixel(count, innerW, 56, indexToPx);
    const positions = indices.map(indexToPx);
    expect(positions[0]).toBeLessThan(innerW * 0.15);
    const gaps = indices.slice(1).map((value, i) => value - indices[i]!);
    gaps.forEach((gap) => expect(gap).toBe(gaps[0]));
  });

  it("pickCategoryTicks thins labels when viewport is narrow", () => {
    const cats = Array.from({ length: 20 }, (_, i) => `c${i}`);
    const thinned = pickCategoryTicks(cats, 80);
    expect(thinned.length).toBeLessThan(cats.length);
    expect(thinned[0]).toBe("c0");
    expect(thinned[thinned.length - 1]).toBe("c19");
  });

  it("pickCategoryTickIndicesForLabels keeps endpoints and spans band centers", () => {
    const provinces = [
      "云南省",
      "河北省",
      "江苏省",
      "广东省",
      "北京市",
      "上海市",
      "山东省",
      "浙江省",
      "四川省",
      "湖北省",
      "河南省",
      "湖南省",
      "福建省",
      "安徽省",
      "江西省",
      "辽宁省",
      "黑龙江省",
      "吉林省",
      "陕西省",
      "甘肃省",
      "贵州省",
      "海南省",
      "天津市",
      "重庆市",
      "广西壮族自治区",
    ];
    const innerW = 900;
    const count = provinces.length;
    const bw = innerW / count * 0.8;
    const toPx = (i: number) => estimateCategoryBandCenterPx(i, count, innerW, bw);
    const indices = pickCategoryTickIndicesForLabels(
      provinces,
      innerW,
      (c) => String(c),
      48,
      -45,
      toPx,
    );
    expect(indices).toContain(0);
    const gaps = indices.slice(1).map((value, i) => value - indices[i]!);
    gaps.forEach((gap) => expect(gap).toBe(gaps[0]));
  });

  it("pickUniformOverlapAwareTickIndices shows all when labels do not overlap", () => {
    const labels = Array.from({ length: 12 }, (_, i) => String(i));
    const innerW = 900;
    const count = labels.length;
    const bw = (innerW / count) * 0.8;
    const toPx = (i: number) => estimateCategoryBandCenterPx(i, count, innerW, bw);
    const indices = pickUniformOverlapAwareTickIndices(
      count,
      labels,
      (c) => String(c),
      0,
      12,
      toPx,
    );
    expect(indices.length).toBe(count);
  });

  it("pickUniformOverlapAwareTickIndices thins with constant step when overlap required", () => {
    const provinces = Array.from({ length: 25 }, (_, i) => `省${i}`);
    const innerW = 320;
    const count = provinces.length;
    const toPx = (i: number) => estimateCategoryBandCenterPx(i, count, innerW);
    const indices = pickUniformOverlapAwareTickIndices(
      count,
      provinces,
      (c) => String(c),
      -45,
      12,
      toPx,
    );
    expect(indices.length).toBeLessThan(count);
    expect(indices[0]).toBe(0);
    const gaps = indices.slice(1).map((v, i) => v - indices[i]!);
    gaps.forEach((gap) => expect(gap).toBe(gaps[0]));
  });

  it("drawCategoryBandAxisBottom anchors labels at band centers", () => {
    const categories = ["河北省", "江苏省", "广东省"];
    const innerW = 300;
    const x = d3.scaleBand<string>().domain(categories).range([0, innerW]).padding(0.2);
    const host = document.createElement("div");
    document.body.appendChild(host);
    const svg = d3.select(host).append("svg").attr("width", innerW).attr("height", 60);
    const g = svg.append("g");
    drawCategoryBandAxisBottom(g, x, innerW, categories, -45, {
      axisLine: "#999",
      axisLabel: "#333",
      gridLine: "#eee",
      accent: "#465fff",
    });
    const texts = [...host.querySelectorAll(".vs-axis-x text")];
    expect(texts.length).toBe(3);
    expect(Number(texts[0]?.getAttribute("y"))).toBeGreaterThan(12);
    const bw = x.bandwidth();
    texts.forEach((node, i) => {
      const cx = Number(node.getAttribute("x"));
      const expected = (x(categories[i]!) ?? 0) + bw / 2;
      expect(cx).toBeCloseTo(expected, 1);
    });
    host.remove();
  });

  it("resolveCategoryLabelRotate defaults to horizontal when unspecified", () => {
    const ticks = ["一月", "二月", "三月", "四月", "五月", "六月"];
    expect(resolveCategoryLabelRotate(ticks, 180)).toBe(0);
    expect(resolveCategoryLabelRotate(ticks, 600)).toBe(0);
    expect(resolveCategoryLabelRotate(ticks, 180, 0)).toBe(0);
    expect(resolveCategoryLabelRotate(ticks, 180, -45)).toBe(-45);
  });

  it("resolveCategoryLabelRotate auto mode rotates when slots are tight", () => {
    const ticks = ["一月", "二月", "三月", "四月", "五月", "六月"];
    expect(resolveCategoryLabelRotate(ticks, 180, "auto")).toBeLessThan(0);
    expect(resolveCategoryLabelRotate(ticks, 600, "auto")).toBe(0);
  });

  it("planCategoryAxisLayout keeps dense ticks horizontal by default and still thins", () => {
    const cats = Array.from({ length: 16 }, (_, i) => `类目${i + 1}`);
    const layout = planCategoryAxisLayout(cats, 160);
    expect(layout.ticks.length).toBeLessThan(cats.length);
    expect(layout.rotateDeg).toBe(0);
    expect(layout.extraBottom).toBe(0);
  });

  it("planCategoryAxisLayout stays horizontal when rotate is explicitly 0", () => {
    const cats = Array.from({ length: 16 }, (_, i) => `类目${i + 1}`);
    const layout = planCategoryAxisLayout(cats, 160, 0);
    expect(layout.rotateDeg).toBe(0);
    expect(layout.extraBottom).toBe(0);
  });

  it("planCategoryAxisLayout auto mode reserves bottom when rotated", () => {
    const cats = Array.from({ length: 16 }, (_, i) => `类目${i + 1}`);
    const layout = planCategoryAxisLayout(cats, 160, "auto");
    expect(layout.ticks.length).toBeLessThan(cats.length);
    if (layout.rotateDeg) expect(layout.extraBottom).toBeGreaterThan(0);
  });

  it("formatAxisCategoryLabel hides labels that do not fit in slot", () => {
    expect(formatAxisCategoryLabel("abcdefghijklmnop", 24, 0)).toBe("");
    expect(formatAxisCategoryLabel("短", 48, 0)).toBe("短");
  });

  it("formatAxisCategoryLabel renders multi-dimension composite keys readably", () => {
    expect(formatAxisCategoryLabel("华东\u00012025-01", 120, 0)).toBe("华东 / 2025-01");
  });

  it("thins CJK province labels so estimated boxes do not overlap", () => {
    const cats = [
      "上海市",
      "吉林省",
      "安徽省",
      "山东省",
      "山西省",
      "广东省",
      "江苏省",
      "江西省",
      "河北省",
      "河南省",
      "浙江省",
      "海南省",
      "湖北省",
      "湖南省",
      "甘肃省",
      "福建省",
      "贵州省",
      "辽宁省",
    ];
    const innerW = 560;
    const layout = planCategoryAxisLayout(cats, innerW);
    expect(layout.ticks.length).toBeLessThan(cats.length);
    const toPx = (idx: number) => estimateCategoryBandCenterPx(idx, cats.length, innerW);
    const shown = layout.ticks
      .map((tick) => cats.indexOf(tick))
      .filter((idx) => idx >= 0);
    const gap = 12;
    for (let i = 1; i < shown.length; i += 1) {
      const prev = shown[i - 1]!;
      const curr = shown[i]!;
      const minDist =
        (estimateAxisLabelTextWidth(cats[prev]!, layout.rotateDeg) +
          estimateAxisLabelTextWidth(cats[curr]!, layout.rotateDeg)) /
          2 +
        gap;
      expect(toPx(curr) - toPx(prev)).toBeGreaterThanOrEqual(minDist - 0.5);
    }
  });

  it("planCategoryAxisLayout auto mode rotates when composite labels are long", () => {
    const cats = Array.from({ length: 8 }, (_, i) => `产品${i + 1}\u0001类目${i + 1}\u00012025-01-0${i + 1}`);
    const layout = planCategoryAxisLayout(cats, 160, "auto");
    expect(layout.rotateDeg).toBeLessThan(0);
  });

  it("planCategoryAxisLayout stays horizontal when composite labels are long by default", () => {
    const cats = Array.from({ length: 8 }, (_, i) => `产品${i + 1}\u0001类目${i + 1}\u00012025-01-0${i + 1}`);
    const layout = planCategoryAxisLayout(cats, 160);
    expect(layout.rotateDeg).toBe(0);
  });

  it("planCategoryAxisLayout keeps dense ISO dates horizontal by default", () => {
    const dates = Array.from({ length: 40 }, (_, i) => {
      const day = 26 + i;
      const d = new Date(Date.UTC(2025, 2, day));
      return d.toISOString().slice(0, 10);
    });
    const layout = planCategoryAxisLayout(dates, 560);
    expect(layout.rotateDeg).toBe(0);
    expect(layout.extraBottom).toBe(0);
    expect(layout.ticks.length).toBeGreaterThan(1);
    expect(layout.ticks.length).toBeLessThan(dates.length);
  });

  it("formatHorizontalBandAxisLabel hides labels when width is limited", () => {
    expect(formatHorizontalBandAxisLabel("2024年第一季度", 40)).toBe("");
    expect(formatHorizontalBandAxisLabel("短", 80)).toBe("短");
  });

  it("resolveHorizontalCategoryAxisLayout thins ticks and expands left margin", () => {
    const cats = Array.from({ length: 12 }, (_, i) => `2024Q${(i % 4) + 1}`);
    const layout = resolveHorizontalCategoryAxisLayout(cats, 100);
    expect(layout.ticks.length).toBeLessThan(cats.length);
    expect(layout.leftMargin).toBeGreaterThanOrEqual(52);
  });

  it("resolveBandAxisFontSize shrinks but never hides labels", () => {
    expect(resolveBandAxisFontSize(16)).toBe(11);
    expect(resolveBandAxisFontSize(8)).toBeGreaterThanOrEqual(7);
  });

  it("resolveNumericTickCount scales with span without over-thinning", () => {
    expect(resolveNumericTickCount(80)).toBeGreaterThanOrEqual(2);
    expect(resolveNumericTickCount(240)).toBeGreaterThanOrEqual(4);
  });

  it("planNumericAxisTicks thins wide formatted labels on narrow spans", () => {
    const scale = d3.scaleLinear().domain([0, 22_000]).nice();
    const format = (v: d3.NumberValue) => Number(v).toLocaleString("en-US");
    const ticks = planNumericAxisTicks(scale, 284, format);
    expect(ticks.length).toBeLessThanOrEqual(6);
    expect(ticks[0]).toBe(0);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(20_000);
  });

  it("valueAxisUpperBound leaves headroom above small integer peaks", () => {
    expect(valueAxisUpperBound(0)).toBe(1);
    expect(valueAxisUpperBound(2)).toBe(3);
    expect(valueAxisUpperBound(4)).toBe(5);
    expect(valueAxisUpperBound(100)).toBeCloseTo(112, 5);
  });

  it("distinctFormattedNumericTickValues drops duplicate integer labels on small domains", () => {
    const scale = d3.scaleLinear().domain([0, 1]).nice();
    const format = (v: d3.NumberValue) => String(Math.round(Number(v)));
    const ticks = distinctFormattedNumericTickValues(scale, 420, format);
    const labels = ticks.map((tick) => format(tick));
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels).toContain("0");
    expect(labels).toContain("1");
  });

  it("nearestCategory finds closest x", () => {
    const cats = ["a", "b", "c"];
    const x = d3.scalePoint<string>().domain(cats).range([0, 100]).padding(0.5);
    expect(nearestCategory(50, cats, x)).toBe("b");
  });

  it("scales label width and cartesian margin with axis font size", () => {
    const at11 = estimateAxisLabelWidth(10);
    const marginAt11 = cartesianMargin();
    setAxisFontSize(22);
    expect(estimateAxisLabelWidth(10)).toBeCloseTo(at11 * 2, 0);
    expect(cartesianMargin().left).toBe(marginAt11.left * 2);
    expect(cartesianMargin().bottom).toBe(marginAt11.bottom * 2);
  });

  it("thins more category ticks when paint axis font is larger", () => {
    const cats = Array.from({ length: 20 }, (_, i) => `类目${i + 1}`);
    const at11 = planCategoryAxisLayout(cats, 400).ticks.length;
    setAxisFontSize(22);
    const at22 = planCategoryAxisLayout(cats, 400).ticks.length;
    expect(at22).toBeLessThanOrEqual(at11);
  });
});
