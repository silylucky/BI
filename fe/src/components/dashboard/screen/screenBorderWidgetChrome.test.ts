import { describe, expect, it } from "vitest";
import { applyScreenBorderShellPresentation } from "./screenBorderWidgetChrome";

describe("screenBorderWidgetChrome", () => {
  it("strips default widget shell chrome for border assets", () => {
    const layers = applyScreenBorderShellPresentation({
      shell: {
        style: { border: "1px solid red", padding: 12, backgroundColor: "#fff" },
        backgroundLayers: [{ backgroundColor: "#000" }],
        frameLayers: [{ border: "1px solid blue" }],
      },
      content: {
        style: { padding: 8 },
        backgroundLayers: [{ backgroundColor: "#111" }],
      },
    });

    expect(layers.shell.style.border).toBe("none");
    expect(layers.shell.style.padding).toBe(0);
    expect(layers.shell.backgroundLayers).toEqual([]);
    expect(layers.shell.frameLayers).toEqual([]);
    expect(layers.content.style.padding).toBe(0);
    expect(layers.content.backgroundLayers).toEqual([]);
    expect(layers.content.frameLayers).toEqual([]);
  });
});
