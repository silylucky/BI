import { describe, expect, it } from "vitest";
import { buildScatterCategoryXLayout } from "@/components/charts/engine/d3/relation/scatterCategoryX";

describe("buildScatterCategoryXLayout", () => {
  it("anchors points at band centers and spreads duplicates within category", () => {
    const data = [
      { x: "广东", y: 10 },
      { x: "广东", y: 20 },
      { x: "浙江", y: 15 },
    ];
    const { xBand, xPositions } = buildScatterCategoryXLayout(data, "x", ["广东", "浙江"], 300);

    const guangdongCenter = (xBand("广东") ?? 0) + xBand.bandwidth() / 2;
    const zhejiangCenter = (xBand("浙江") ?? 0) + xBand.bandwidth() / 2;

    expect(xPositions[2]).toBe(zhejiangCenter);
    expect(xPositions[0]).not.toBe(xPositions[1]);
    expect(xPositions[0] - guangdongCenter).toBeCloseTo(-(xPositions[1] - guangdongCenter), 5);
  });
});
