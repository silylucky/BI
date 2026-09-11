import { describe, expect, it } from "vitest";
import { createPaletteWidget } from "./createLayoutWidget";

describe("createPaletteWidget screen-title-bar", () => {
  it("creates text widget with borderless decor background", () => {
    const widget = createPaletteWidget("screen-title-bar", []);
    expect(widget.type).toBe("text");
    expect(widget.title).toBe("标题条");
    expect(widget.textConfig?.content).toBe("");
    expect(widget.textConfig?.widgetStyle?.backgroundMode).toBe("image");
    expect(widget.textConfig?.widgetStyle?.backgroundImage).toContain(
      "/template-assets/packs/gov-enterprise-v1/top-decor-clear/",
    );
    expect(widget.textConfig?.widgetStyle?.backgroundImageFit).toBe("widthFit");
    expect(widget.textConfig?.widgetStyle?.backgroundImagePosition).toBe("center");
  });
});
