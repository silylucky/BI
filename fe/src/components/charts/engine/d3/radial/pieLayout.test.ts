import { describe, expect, it } from "vitest";
import { capPieRadiusForOutsideLabels, computePieLayout } from "./pieLayout";
import { pieOutsideLabelExtentFromCenter } from "./pieLabels";

describe("computePieLayout", () => {
  it("uses right-side legend on wide containers", () => {
    const wide = computePieLayout(400, 160, true);
    const wideNoLegend = computePieLayout(400, 160, false);

    expect(wide.legendMode).toBe("right");
    expect(wide.maxR).toBeGreaterThan(wideNoLegend.maxR * 0.55);
    expect(wide.maxR).toBeCloseTo((160 - 16) / 2, 0);
  });

  it("fills height on wide layout instead of centering tiny pie", () => {
    const layout = computePieLayout(432, 157, true);
    expect(layout.legendMode).toBe("right");
    expect(layout.maxR).toBeGreaterThan(60);
  });

  it("reserves bottom margin for inline legend on square containers", () => {
    const items = [{ label: "华东", color: "#465fff" }];
    const withLegend = computePieLayout(200, 200, true, { position: "bottom" }, items);
    const withoutLegend = computePieLayout(200, 200, false);

    expect(withLegend.legendMode).toBe("inline");
    expect(withLegend.margin.bottom).toBeGreaterThan(withoutLegend.margin.bottom);
    expect(withLegend.maxR).toBeLessThan(withoutLegend.maxR);
  });

  it("shrinks pie radius so long outside labels fit the canvas width", () => {
    const width = 708;
    const height = 791;
    const fit = { maxTextWidth: 140, fontSize: 11, radiusFrac: 0.77 };
    const plain = computePieLayout(width, height, false);
    const labeled = computePieLayout(width, height, false, undefined, [], true, fit);

    expect(labeled.maxR).toBeLessThan(plain.maxR);
    const outerR = labeled.maxR * fit.radiusFrac;
    const extent = pieOutsideLabelExtentFromCenter(outerR, fit.fontSize, fit.maxTextWidth);
    const horiz = Math.min(labeled.cx, width - labeled.cx) - 4;
    expect(extent).toBeLessThanOrEqual(horiz + 0.5);
  });

  it("caps radius against the nearer canvas edge", () => {
    const capped = capPieRadiusForOutsideLabels(300, 200, 400, {
      maxTextWidth: 120,
      fontSize: 11,
      radiusFrac: 0.77,
    });
    expect(capped).toBeLessThan(300);
    const extent = pieOutsideLabelExtentFromCenter(capped * 0.77, 11, 120);
    expect(extent).toBeLessThanOrEqual(196);
  });
});
