import { describe, expect, it } from "vitest";
import type { DashboardLayoutV2, PixelLayoutWidget } from "../layoutUtils";
import { layoutsOverlap } from "./collisionLayout";
import { resolvePaletteDropCollisionPreview } from "./paletteDropCollisionPreview";

const base: PixelLayoutWidget = {
  id: "w1",
  type: "chart",
  title: "A",
  order: 1,
  x: 100,
  y: 80,
  width: 300,
  height: 200,
};

const blocker: PixelLayoutWidget = {
  id: "w2",
  type: "chart",
  title: "B",
  order: 2,
  x: 100,
  y: 280,
  width: 300,
  height: 200,
};

const layout: DashboardLayoutV2 = {
  version: 2,
  canvas: { width: 1440, height: 900 },
  widgets: [base, blocker],
  globalFilters: [],
};

describe("paletteDropCollisionPreview", () => {
  it("pushes neighbors while palette hovers over stacked column", () => {
    const preview = resolvePaletteDropCollisionPreview(
      layout,
      { x: 220, y: 180 },
      "bar",
      { gap: 0, minOverlap: 40 },
    );
    expect(preview).not.toBeNull();
    const moved = preview!.positions.get("w2");
    expect(moved?.y).toBeGreaterThan(280);
    expect(layoutsOverlap(
      {
        ...layout,
        widgets: layout.widgets.map((widget) => ({
          ...widget,
          ...(preview!.positions.get(widget.id) ?? widget),
        })),
      },
      0,
    )).toBe(false);
  });

  it("skips squeeze on data-screen surfaces", () => {
    const screenLayout: DashboardLayoutV2 = {
      ...layout,
      styleConfig: { surfaceKind: "data-screen" },
    };
    expect(
      resolvePaletteDropCollisionPreview(screenLayout, { x: 220, y: 180 }, "bar"),
    ).toBeNull();
  });
});
