import { describe, expect, it } from "vitest";
import {
  estimateV1GridCanvasHeight,
  resolveTemplateGridFitScale,
} from "./templateGridFitScale";

describe("templateGridFitScale", () => {
  it("estimates grid canvas height from row spans", () => {
    const height = estimateV1GridCanvasHeight([
      {
        id: "kpi",
        type: "chart",
        title: "KPI",
        order: 0,
        colSpan: 12,
        rowSpan: 1,
        gridY: 0,
      },
      {
        id: "chart",
        type: "chart",
        title: "Chart",
        order: 1,
        colSpan: 6,
        rowSpan: 5,
        gridY: 1,
      },
    ]);
    expect(height).toBe(6 * 32);
  });

  it("scales down when content exceeds host height in card mode", () => {
    expect(resolveTemplateGridFitScale(120, 240, { mode: "card" })).toBe(0.5);
    expect(resolveTemplateGridFitScale(300, 240, { mode: "card" })).toBe(1);
  });

  it("scales up in dialog mode to fill tall viewport", () => {
    expect(resolveTemplateGridFitScale(720, 240, { mode: "dialog" })).toBe(1.75);
    expect(resolveTemplateGridFitScale(480, 240, { mode: "dialog" })).toBe(1.75);
  });

  it("limits scale when content is wider than host", () => {
    expect(
      resolveTemplateGridFitScale(720, 240, {
        mode: "dialog",
        availableWidth: 400,
        contentWidth: 800,
      }),
    ).toBe(0.65);
  });
});
