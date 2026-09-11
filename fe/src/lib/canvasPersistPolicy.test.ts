import { describe, expect, it } from "vitest";
import { buildDefaultLayoutForSurface } from "@/lib/surfacePreset";
import {
  clampCanvasHeightForPersist,
  DATA_SCREEN_CANVAS,
  resolvePersistedCanvasMinHeight,
} from "./canvasPersistPolicy";

describe("canvasPersistPolicy", () => {
  it("uses 1080 min height for data-screen", () => {
    expect(
      resolvePersistedCanvasMinHeight({ styleConfig: { surfaceKind: "data-screen" } }),
    ).toBe(1080);
  });

  it("uses 900 min height for dashboard", () => {
    expect(resolvePersistedCanvasMinHeight({ styleConfig: { surfaceKind: "dashboard" } })).toBe(
      900,
    );
  });

  it("does not shrink data-screen canvas when widgets are shorter than 1080", () => {
    const base = buildDefaultLayoutForSurface("data-screen");
    const layout = {
      ...base,
      widgets: [
        {
          id: "w1",
          type: "chart" as const,
          title: "A",
          order: 0,
          x: 0,
          y: 0,
          width: 800,
          height: 583,
          chartConfig: { chartType: "line" as const },
        },
      ],
    };
    const clamped = clampCanvasHeightForPersist(layout);
    expect(clamped.canvas.height).toBe(DATA_SCREEN_CANVAS.height);
  });
});
