import { describe, expect, it } from "vitest";
import { buildCustomVizStyleHooksCss, styleSchemaKeyToCssVar } from "./customVizStyleHooks";

describe("buildCustomVizStyleHooksCss", () => {
  it("generates selector rules from manifest hooks", () => {
    const css = buildCustomVizStyleHooksCss({
      accentColor: { selectors: [".fill", ".bar"] },
      showRankBadge: {
        hideWhenFalse: true,
        hideSelectors: [".badge"],
      },
    });
    expect(css).toContain(".vs-custom-viz-host .fill");
    expect(css).toContain("--vs-style-accent-color");
    expect(css).toContain('[data-vs-show-rank-badge="false"] .badge');
  });

  it("honors custom cssVar names", () => {
    expect(styleSchemaKeyToCssVar("accentColor", "--vs-palette-0")).toBe("--vs-palette-0");
  });
});
