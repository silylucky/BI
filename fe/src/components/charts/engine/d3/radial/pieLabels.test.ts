import { describe, expect, it } from "vitest";
import {
  formatPieSliceLabel,
  formatPieTooltipValue,
  layoutPieOutsideLabels,
  outsideLabelRowGap,
  pieArcLayoutKey,
  pieOutsideLabelBounds,
  pieOutsideLabelGeometry,
  resolvePieLabelRenderOptions,
} from "./pieLabels";

describe("pieLabels", () => {
  it("defaults to inside + indicator only", () => {
    expect(resolvePieLabelRenderOptions(undefined)).toEqual({
      position: "inside",
      showDimension: false,
      showIndicator: true,
      showPercent: false,
      percentDecimals: 2,
    });
  });

  it("defaults to dimension + indicator + percent when outside", () => {
    expect(resolvePieLabelRenderOptions({ position: "outside" })).toEqual({
      position: "outside",
      showDimension: true,
      showIndicator: true,
      showPercent: true,
      percentDecimals: 2,
    });
  });

  it("formats dimension, indicator and percent for outside labels", () => {
    const opts = resolvePieLabelRenderOptions({ position: "outside" });
    const text = formatPieSliceLabel(
      { type: "华东", value: 25 },
      "type",
      "value",
      100,
      opts,
      { type: "auto", thousandSeparator: true },
    );
    expect(text).toContain("华东");
    expect(text).toContain("25");
    expect(text).toContain("25.00%");
    expect(text).toMatch(/华东.*25.*\(25\.00%\)/);
  });

  it("builds radial geometry for right-side labels", () => {
    const geo = pieOutsideLabelGeometry(Math.PI / 2, 80, 11);
    expect(geo.anchor).toBe("start");
    expect(geo.textX).toBeGreaterThan(80);
  });

  it("anchors leader line at per-slice outer radius (rose chart)", () => {
    const outerR = 80;
    const geoFull = pieOutsideLabelGeometry(Math.PI / 2, outerR, 11, outerR);
    const geoSmall = pieOutsideLabelGeometry(Math.PI / 2, outerR, 11, 24);
    expect(geoSmall.x0).toBe(24);
    expect(geoFull.x0).toBe(80);
    expect(geoSmall.x0).toBeLessThan(geoFull.x0);
  });

  it("formats tooltip value with percent", () => {
    const text = formatPieTooltipValue(628, 10000, { type: "auto", thousandSeparator: true }, 2);
    expect(text).toContain("628");
    expect(text).toMatch(/\(6\.28%\)/);
  });

  it("distributes labels radially around the circle", () => {
    const outerR = 80;
    const candidates = [
      { key: "a", midAngle: 0.3, sliceAngle: 0.2, text: "A" },
      { key: "b", midAngle: 1.2, sliceAngle: 0.2, text: "B" },
      { key: "c", midAngle: 2.4, sliceAngle: 0.2, text: "C" },
    ];
    const placed = layoutPieOutsideLabels(
      candidates,
      outerR,
      11,
      pieOutsideLabelBounds(outerR),
    );
    const positions = candidates
      .map((c) => placed.get(c.key))
      .filter((p) => p?.visible)
      .map((p) => ({ x: p!.textX, y: p!.textY }));
    expect(positions.length).toBe(3);
    const ys = new Set(positions.map((p) => p.y));
    expect(ys.size).toBeGreaterThan(1);
  });

  it("keeps more labels for rose-like equal-angle slices via overlap nudging", () => {
    const outerR = 60;
    const sliceAngle = 2 * Math.PI / 35;
    const candidates = Array.from({ length: 35 }, (_, i) => ({
      key: pieArcLayoutKey(sliceAngle * i, sliceAngle * (i + 1)),
      midAngle: sliceAngle * i + sliceAngle / 2,
      sliceAngle,
      text: `2025-01-${String(i + 1).padStart(2, "0")} 1,000 (1%)`,
      priority: 1000 + i,
    }));
    const placed = layoutPieOutsideLabels(candidates, outerR, 11, { ymin: -80, ymax: 80 });
    const visible = candidates.filter((c) => placed.get(c.key)?.visible).length;
    expect(visible).toBeGreaterThan(5);
    expect(visible).toBeLessThan(candidates.length);
  });

  it("prefers higher priority when labels still overlap after nudging", () => {
    const outerR = 50;
    const candidates = [
      {
        key: "low",
        midAngle: 0.5,
        sliceAngle: 0.15,
        text: "小扇区 100 (1%)",
        priority: 100,
      },
      {
        key: "high",
        midAngle: 0.55,
        sliceAngle: 0.15,
        text: "大扇区 9,999 (90%)",
        priority: 9999,
      },
    ];
    const placed = layoutPieOutsideLabels(candidates, outerR, 11, { ymin: -60, ymax: 60 });
    expect(placed.get("high")?.visible).toBe(true);
  });

  it("keeps leader elbows on radial spokes (no tangential bend)", () => {
    const outerR = 80;
    const connectR = 24;
    const midAngle = 2.1;
    const geo = pieOutsideLabelGeometry(midAngle, outerR, 11, connectR);
    const cross = geo.x1 * geo.y0 - geo.y1 * geo.x0;
    expect(Math.abs(cross)).toBeLessThan(0.01);
  });

  it("aligns same-side labels to a shared margin column", () => {
    const outerR = 60;
    const sliceAngle = 2 * Math.PI / 12;
    const candidates = Array.from({ length: 12 }, (_, i) => ({
      key: String(i),
      midAngle: sliceAngle * i + sliceAngle / 2,
      sliceAngle,
      text: `标签${i}`,
    }));
    const placed = layoutPieOutsideLabels(candidates, outerR, 11, { ymin: -90, ymax: 90 }, true);
    const rightXs = candidates
      .filter((c) => Math.cos(c.midAngle - Math.PI / 2) >= 0)
      .map((c) => placed.get(c.key)?.textX)
      .filter((x): x is number => x != null);
    const leftXs = candidates
      .filter((c) => Math.cos(c.midAngle - Math.PI / 2) < 0)
      .map((c) => placed.get(c.key)?.textX)
      .filter((x): x is number => x != null);
    expect(new Set(rightXs).size).toBe(1);
    expect(new Set(leftXs).size).toBe(1);
  });

  it("avoids intersecting leader lines among visible labels", () => {
    const outerR = 60;
    const sliceAngle = 2 * Math.PI / 20;
    const candidates = Array.from({ length: 20 }, (_, i) => ({
      key: String(i),
      midAngle: sliceAngle * i + sliceAngle / 2,
      sliceAngle,
      text: `2025-01-${String(i + 1).padStart(2, "0")} 1,000 (5%)`,
    }));
    const placed = layoutPieOutsideLabels(candidates, outerR, 11, { ymin: -90, ymax: 90 }, true);
    const visible = candidates
      .map((c) => placed.get(c.key))
      .filter((p) => p?.visible);
    const parseSegs = (points: string): [number, number, number, number][] => {
      const nums = points.split(/[\s,]+/).map(Number);
      const segs: [number, number, number, number][] = [];
      for (let i = 0; i < nums.length - 2; i += 2) {
        segs.push([nums[i], nums[i + 1], nums[i + 2], nums[i + 3]]);
      }
      return segs;
    };
    const cross = (
      ax0: number,
      ay0: number,
      ax1: number,
      ay1: number,
      bx0: number,
      by0: number,
      bx1: number,
      by1: number,
    ): boolean => {
      const d = (ax1 - ax0) * (by1 - by0) - (ay1 - ay0) * (bx1 - bx0);
      if (Math.abs(d) < 1e-9) return false;
      const t = ((bx0 - ax0) * (by1 - by0) - (by0 - ay0) * (bx1 - bx0)) / d;
      const u = ((bx0 - ax0) * (ay1 - ay0) - (by0 - ay0) * (ax1 - ax0)) / d;
      return t > 1e-5 && t < 1 - 1e-5 && u > 1e-5 && u < 1 - 1e-5;
    };
    for (let i = 0; i < visible.length; i += 1) {
      for (let j = i + 1; j < visible.length; j += 1) {
        const aSegs = parseSegs(visible[i]!.points);
        const bSegs = parseSegs(visible[j]!.points);
        for (const [ax0, ay0, ax1, ay1] of aSegs) {
          for (const [bx0, by0, bx1, by1] of bSegs) {
            expect(cross(ax0, ay0, ax1, ay1, bx0, by0, bx1, by1)).toBe(false);
          }
        }
      }
    }
  });

  it("avoids coincident horizontal leader segments on the same side", () => {
    const outerR = 60;
    const sliceAngle = 2 * Math.PI / 24;
    const candidates = Array.from({ length: 24 }, (_, i) => ({
      key: String(i),
      midAngle: sliceAngle * i + sliceAngle / 2,
      sliceAngle,
      text: `省${i} 1,000 (4%)`,
    }));
    const placed = layoutPieOutsideLabels(candidates, outerR, 11, { ymin: -100, ymax: 100 }, true);
    const visible = candidates
      .map((c) => placed.get(c.key))
      .filter((p) => p?.visible && p.points);
    const horizontals: string[] = [];
    for (const p of visible) {
      const nums = p!.points.split(/[\s,]+/).map(Number);
      if (nums.length >= 6) {
        horizontals.push(`${nums[2]},${nums[3]},${nums[4]},${nums[5]}`);
      }
    }
    expect(new Set(horizontals).size).toBe(horizontals.length);
  });

  it("hides labels that overflow the horizontal canvas bounds", () => {
    const outerR = 80;
    const candidates = [
      {
        key: "left",
        midAngle: Math.PI * 1.5,
        sliceAngle: 0.4,
        text: "海南省 48,102 (2.20%)",
      },
    ];
    const placed = layoutPieOutsideLabels(candidates, outerR, 11, {
      ymin: -120,
      ymax: 120,
      xmin: -90,
      xmax: 90,
    });
    expect(placed.get("left")?.visible).toBe(false);
  });
});
