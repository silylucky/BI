import { describe, expect, it } from "vitest";
import { resolvePreviewWidgetVisual } from "./previewWidgetVisual";

describe("resolvePreviewWidgetVisual", () => {
  it("maps chart types to visual families", () => {
    expect(resolvePreviewWidgetVisual("chart", "line")).toBe("line");
    expect(resolvePreviewWidgetVisual("chart", "pie")).toBe("pie");
    expect(resolvePreviewWidgetVisual("chart", "map-3d")).toBe("map");
    expect(resolvePreviewWidgetVisual("filter")).toBe("filter");
  });
});
