import { describe, expect, it } from "vitest";
import { createCustomVizWidget, createPaletteWidget } from "./createLayoutWidget";

describe("createCustomVizWidget", () => {
  it("builds customViz widget with artifact binding", () => {
    const widget = createPaletteWidget(
      { type: "customViz", artifactId: "art-1", displayName: "排名条" },
      [],
    );
    expect(widget.type).toBe("customViz");
    expect(widget.customVizConfig?.artifactId).toBe("art-1");
    expect(widget.title).toBe("排名条");
  });

  it("createCustomVizWidget defaults title", () => {
    const widget = createCustomVizWidget("art-2", "", []);
    expect(widget.title).toBe("自定义组件");
  });
});
