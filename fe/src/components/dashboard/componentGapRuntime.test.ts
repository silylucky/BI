import { describe, expect, it } from "vitest";
import { resolveComponentGapRuntime } from "./componentGapRuntime";

describe("componentGapRuntime", () => {
  it("maps pixel md preset to shell and snap padding", () => {
    const runtime = resolveComponentGapRuntime(
      { gapPreset: "md", widgetGap: 8, pixelGutter: 5 },
      "pixel",
    );
    expect(runtime.shellPaddingPx).toBe(5);
    expect(runtime.snapGapPx).toBe(5);
    expect(runtime.collisionGapPx).toBe(0);
    expect(runtime.collisionOverlapBufferPx).toBe(40);
  });

  it("maps grid md preset separately from pixel", () => {
    const runtime = resolveComponentGapRuntime(
      { gapPreset: "md", widgetGap: 8, pixelGutter: 5 },
      "grid",
    );
    expect(runtime.shellPaddingPx).toBe(8);
    expect(runtime.collisionGapPx).toBe(0);
    expect(runtime.collisionOverlapBufferPx).toBe(40);
  });
});
