import { describe, expect, it } from "vitest";
import {
  buildBorderFlowPathsFromDeFrames,
  pickOuterFlowSubpath,
  scaleNormalizedFlowPath,
} from "./screenBorderFlowPathExtract";
import { DATAEASE_BOARD_SVGS } from "./chartFrameBorderSvgs";
import { SCREEN_BORDER_DE_FRAME_IDS } from "./screenBorderDeFrames";
import type { ScreenBorderVariant } from "./screenVisualStyle";
import {
  BORDER_FLOW_PATHS,
  getBorderFlowSegment,
  getBorderFlowSegments,
} from "./screenBorderFlowPaths";

const VARIANTS = Object.keys(SCREEN_BORDER_DE_FRAME_IDS) as ScreenBorderVariant[];

describe("screenBorderFlowPathExtract", () => {
  it("extracts outer ring from each DataEase frame", () => {
    for (const variant of VARIANTS) {
      const frameId = SCREEN_BORDER_DE_FRAME_IDS[variant];
      const svg = DATAEASE_BOARD_SVGS[frameId]!;
      const { d } = pickOuterFlowSubpath(svg);
      expect(d).toMatch(/^M\s[\d.-]/);
      expect(d).toMatch(/Z$/i);
    }
  });

  it("builds distinct normalized paths per border variant", () => {
    const paths = buildBorderFlowPathsFromDeFrames();
    const values = VARIANTS.map((variant) => paths[variant]);
    expect(new Set(values).size).toBe(VARIANTS.length);
    for (const d of values) {
      expect(d).toMatch(/^M\s[\d.-]/);
      expect(d).toMatch(/Z$/i);
    }
  });

  it("keeps start/end coincident for one-way loop motion", () => {
    const paths = buildBorderFlowPathsFromDeFrames();
    for (const variant of VARIANTS) {
      const d = paths[variant];
      const nums = d.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/g)?.map(Number) ?? [];
      const sx = nums[0];
      const sy = nums[1];
      const zIndex = d.toUpperCase().lastIndexOf("Z");
      const beforeZ = d.slice(0, zIndex);
      const tail = beforeZ.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/g)?.map(Number) ?? [];
      const ex = tail.at(-2);
      const ey = tail.at(-1);
      expect(sx, variant).toBeDefined();
      expect(ex, variant).toBeDefined();
      if (sx != null && sy != null && ex != null && ey != null) {
        expect(Math.hypot(ex - sx, ey - sy), variant).toBeLessThan(0.15);
      }
    }
  });

  it("spans full widget height for split-frame borders", () => {
    const paths = buildBorderFlowPathsFromDeFrames();
    for (const variant of ["border-2", "border-3", "border-9"] as const) {
      const d = paths[variant];
      const nums = d.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/g)?.map(Number) ?? [];
      let minY = Infinity;
      let maxY = -Infinity;
      for (let i = 1; i < nums.length; i += 2) {
        const y = nums[i];
        if (y == null || !Number.isFinite(y)) continue;
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
      expect(maxY - minY, variant).toBeGreaterThan(85);
    }
  });

  it("scales normalized flow path to pixel coordinates", () => {
    const base = BORDER_FLOW_PATHS["border-1"];
    const scaled = scaleNormalizedFlowPath(base, 400, 200);
    expect(scaled).toMatch(/^M\s/);
    expect(scaled).not.toBe(base);
    const nums = scaled.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/g)?.map(Number) ?? [];
    expect(nums[0]).toBeCloseTo((base.match(/-?\d*\.?\d+/)?.map(Number)[0] ?? 0) * 4, 0);
  });
});

describe("screenBorderFlowPaths", () => {
  it("returns a visible-line path for every border variant", () => {
    for (const variant of VARIANTS) {
      const segments = getBorderFlowSegments(variant);
      expect(segments).toHaveLength(1);
      expect(segments[0]?.path).toBe(BORDER_FLOW_PATHS[variant]);
      expect(segments[0]?.motion).toBe("loop");
    }
  });

  it("uses distinct paths per border style", () => {
    const paths = VARIANTS.map((variant) => getBorderFlowSegment(variant, 0).path);
    expect(new Set(paths).size).toBe(VARIANTS.length);
  });

  it("matches DataEase frame outer silhouette", () => {
    const extracted = buildBorderFlowPathsFromDeFrames();
    for (const variant of VARIANTS) {
      expect(BORDER_FLOW_PATHS[variant]).toBe(extracted[variant]);
    }
  });
});
