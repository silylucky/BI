import { describe, expect, it } from "vitest";
import { resolveEmbeddedLayoutFootprint } from "./embeddedContainerSize";

describe("resolveEmbeddedLayoutFootprint", () => {
  it("subtracts gap shell, border inset, and title chrome from outer layout rect", () => {
    const inner = resolveEmbeddedLayoutFootprint(
      { width: 452, height: 332 },
      {
        gapPx: 5,
        chromeInset: { top: 2, right: 2, bottom: 2, left: 2 },
        titleChromePx: 36,
      },
    );
    expect(inner).toEqual({ width: 438, height: 282 });
  });
});
