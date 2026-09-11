import { describe, expect, it } from "vitest";
import { hasPositiveOuterGaps, measurePixelLayoutOuterGaps } from "../gapRuntimeProbe";
import { compactPixelLayoutForGapChange, compactPixelLayoutWhenZeroGap } from "./gapCompaction";
import type { DashboardLayoutV2 } from "../layoutUtils";

const baseLayout: DashboardLayoutV2 = {
  version: 2,
  canvas: { width: 1440, height: 900 },
  widgets: [],
  globalFilters: [],
};

describe("gapCompaction", () => {
  it("closes coordinate slack when switching md shell gap to none", () => {
    const layout: DashboardLayoutV2 = {
      ...baseLayout,
      widgets: [
        {
          id: "w1",
          type: "chart",
          title: "左",
          order: 0,
          x: 0,
          y: 0,
          width: 400,
          height: 200,
        },
        {
          id: "w2",
          type: "chart",
          title: "右",
          order: 1,
          x: 420,
          y: 0,
          width: 400,
          height: 200,
        },
      ],
    };

    const result = compactPixelLayoutForGapChange(layout, 5, 0);
    expect(result.compacted).toBe(true);
    expect(result.layout.widgets[1]?.x).toBe(400);
    expect(hasPositiveOuterGaps(result.layout.widgets)).toBe(false);
  });

  it("does not move widgets when shell gap increases", () => {
    const layout: DashboardLayoutV2 = {
      ...baseLayout,
      widgets: [
        {
          id: "w1",
          type: "chart",
          title: "左",
          order: 0,
          x: 0,
          y: 0,
          width: 400,
          height: 200,
        },
        {
          id: "w2",
          type: "chart",
          title: "右",
          order: 1,
          x: 400,
          y: 0,
          width: 400,
          height: 200,
        },
      ],
    };

    const result = compactPixelLayoutForGapChange(layout, 0, 5);
    expect(result.compacted).toBe(false);
    expect(result.layout.widgets[1]?.x).toBe(400);
  });

  it("leaves geometry unchanged when outer rects already touch", () => {
    const layout: DashboardLayoutV2 = {
      ...baseLayout,
      widgets: [
        {
          id: "w1",
          type: "chart",
          title: "左",
          order: 0,
          x: 0,
          y: 0,
          width: 400,
          height: 200,
        },
        {
          id: "w2",
          type: "chart",
          title: "右",
          order: 1,
          x: 400,
          y: 0,
          width: 400,
          height: 200,
        },
      ],
    };

    const result = compactPixelLayoutForGapChange(layout, 5, 0);
    expect(result.layout.widgets[1]?.x).toBe(400);
    expect(hasPositiveOuterGaps(result.layout.widgets)).toBe(false);
  });

  it("compacts coordinate slack when shell gap is already zero", () => {
    const layout: DashboardLayoutV2 = {
      ...baseLayout,
      widgets: [
        {
          id: "w1",
          type: "chart",
          title: "左",
          order: 0,
          x: 0,
          y: 0,
          width: 400,
          height: 200,
        },
        {
          id: "w2",
          type: "chart",
          title: "右",
          order: 1,
          x: 410,
          y: 0,
          width: 400,
          height: 200,
        },
      ],
    };

    const result = compactPixelLayoutWhenZeroGap(layout, { gapPreset: "none", pixelGutter: 0 });
    expect(result.compacted).toBe(true);
    expect(result.layout.widgets[1]?.x).toBe(400);
    expect(hasPositiveOuterGaps(result.layout.widgets)).toBe(false);
  });

  it("compacts a 2x3 grid with 20px coordinate slack", () => {
    const layout: DashboardLayoutV2 = {
      ...baseLayout,
      widgets: [
        { id: "a", type: "chart", title: "A", order: 0, x: 0, y: 0, width: 480, height: 280 },
        { id: "b", type: "chart", title: "B", order: 1, x: 500, y: 0, width: 480, height: 280 },
        { id: "c", type: "chart", title: "C", order: 2, x: 0, y: 300, width: 480, height: 280 },
        { id: "d", type: "chart", title: "D", order: 3, x: 500, y: 300, width: 480, height: 280 },
        { id: "e", type: "chart", title: "E", order: 4, x: 0, y: 600, width: 480, height: 280 },
        { id: "f", type: "chart", title: "F", order: 5, x: 500, y: 600, width: 480, height: 280 },
      ],
    };

    const result = compactPixelLayoutWhenZeroGap(layout, { gapPreset: "none", pixelGutter: 0 });
    expect(result.compacted).toBe(true);
    expect(result.layout.widgets.find((w) => w.id === "b")?.x).toBe(480);
    expect(result.layout.widgets.find((w) => w.id === "c")?.y).toBe(280);
    expect(result.layout.widgets.find((w) => w.id === "d")?.x).toBe(480);
    expect(result.layout.widgets.find((w) => w.id === "d")?.y).toBe(280);
    expect(result.layout.widgets.find((w) => w.id === "e")?.y).toBe(560);
    const gaps = measurePixelLayoutOuterGaps(result.layout.widgets);
    expect(gaps, JSON.stringify(gaps)).toEqual([]);
    expect(hasPositiveOuterGaps(result.layout.widgets)).toBe(false);
  });
});
