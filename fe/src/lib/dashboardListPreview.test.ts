import { describe, expect, it } from "vitest";
import { previewSummaryToLayout } from "./dashboardListPreview";

describe("previewSummaryToLayout", () => {
  it("builds v2 layout for wireframe thumb", () => {
    const layout = previewSummaryToLayout({
      version: 2,
      canvas: { width: 1920, height: 1080 },
      styleConfig: { surfaceKind: "data-screen" },
      widgets: [{ id: "w1", order: 0, x: 100, y: 80, width: 600, height: 360 }],
    });
    expect(layout?.version).toBe(2);
    expect(layout?.widgets).toHaveLength(1);
    expect(layout?.styleConfig?.surfaceKind).toBe("data-screen");
  });
});
