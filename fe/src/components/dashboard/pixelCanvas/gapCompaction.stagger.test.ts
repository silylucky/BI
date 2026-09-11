import { describe, expect, it } from "vitest";
import { persistDashboardLayout } from "../stylePipeline";
import { layoutsOverlap } from "./collisionLayout";
import { compactPixelLayoutWhenZeroGap } from "./gapCompaction";
import type { DashboardLayoutV2 } from "../layoutUtils";

describe("gapCompaction stagger regression", () => {
  const staggered: DashboardLayoutV2 = {
    version: 2,
    canvas: { width: 1440, height: 900 },
    widgets: [
      {
        id: "a",
        type: "chart",
        title: "A",
        order: 0,
        x: 0,
        y: 0,
        width: 400,
        height: 400,
      },
      {
        id: "b",
        type: "chart",
        title: "B",
        order: 1,
        x: 420,
        y: 200,
        width: 400,
        height: 400,
      },
    ],
    globalFilters: [],
  };

  it("must not create overlap when closing positive outer gaps", () => {
    expect(layoutsOverlap(staggered, 0)).toBe(false);
    const result = compactPixelLayoutWhenZeroGap(staggered, {
      gapPreset: "none",
      pixelGutter: 0,
    });
    expect(layoutsOverlap(result.layout, 0)).toBe(false);
  });

  it("persistDashboardLayout must preserve staggered coordinates on save", () => {
    const saved = persistDashboardLayout(staggered, {
      gapPreset: "none",
      pixelGutter: 0,
      widgetGap: 0,
    });
    expect(saved.version).toBe(2);
    if (saved.version !== 2) return;
    expect(layoutsOverlap(saved, 0)).toBe(false);
    expect(saved.widgets.find((w) => w.id === "b")).toMatchObject({ x: 420, y: 200 });
  });

  it("must not collapse a loose 2x3 grid on save when gap is none", () => {
    const looseGrid: DashboardLayoutV2 = {
      version: 2,
      canvas: { width: 1440, height: 900 },
      widgets: [
        { id: "a", type: "chart", title: "A", order: 0, x: 0, y: 0, width: 480, height: 280 },
        { id: "b", type: "chart", title: "B", order: 1, x: 500, y: 0, width: 480, height: 280 },
        { id: "c", type: "chart", title: "C", order: 2, x: 960, y: 0, width: 480, height: 280 },
        { id: "d", type: "chart", title: "D", order: 3, x: 0, y: 300, width: 480, height: 280 },
        { id: "e", type: "chart", title: "E", order: 4, x: 500, y: 300, width: 480, height: 280 },
        { id: "f", type: "chart", title: "F", order: 5, x: 960, y: 300, width: 480, height: 280 },
      ],
      globalFilters: [],
    };
    const saved = persistDashboardLayout(looseGrid, {
      gapPreset: "none",
      pixelGutter: 0,
      widgetGap: 0,
    });
    expect(saved.version).toBe(2);
    if (saved.version !== 2) return;
    expect(saved.widgets.find((w) => w.id === "b")?.x).toBe(500);
    expect(saved.widgets.find((w) => w.id === "c")?.x).toBe(960);
    expect(saved.widgets.find((w) => w.id === "d")?.y).toBe(300);
  });
});
